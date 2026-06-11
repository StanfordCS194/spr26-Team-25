#include "plxparser.h"
#include "string_helpers.h"
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <string_view>
#include <unordered_set>

static constexpr std::string_view kInvalidEntryStarts = "[\\@>/;,(\"";
static constexpr std::string_view kInvalidTranslationStarts = "[\\@>;,";
static constexpr std::string_view kInvalidSymbolStarts = "&#=!?+*";
static constexpr std::string_view kLeadingNoiseChars = "[]{}()\"'`@#$%&*+=~/\\>;,._";

static const std::unordered_set<std::string> kMetadataTerms = {
    "adjective", "adj", "noun", "n", "verb", "v",
    "Huasteca", "Classical", "Neologism", "other", "Possessed",
    "Class1", "Class2", "Class3", "Class4",
    "Past", "I", "you", "he/she/it", "we", "they",
    "XITEMSXX", "Vea", "See", "ACHILCOZTIC", "CHLCZTIC",
    "_", "Ω", "dictionary"
};

static const std::unordered_set<std::string> kInvalidTranslations = {
    "adjective", "noun", "verb", "Huasteca", "Classical", "Neologism",
    "other", "Possessed", "adj", "n", "v"
};

static bool isSeeReference(std::string_view text) {
    return text.rfind("See ", 0) == 0 || text.rfind("Vea ", 0) == 0;
}

static bool startsWithAny(std::string_view text, std::string_view chars) {
    return !text.empty() && chars.find(text.front()) != std::string_view::npos;
}

static bool hasWhitespace(std::string_view text) {
    return text.find_first_of(" \t\n\r") != std::string_view::npos;
}

static size_t countUppercase(std::string_view text) {
    size_t count = 0;
    for (char c : text) {
        if (std::isupper(static_cast<unsigned char>(c))) {
            ++count;
        }
    }
    return count;
}

static size_t countDigits(std::string_view text) {
    size_t count = 0;
    for (char c : text) {
        if (std::isdigit(static_cast<unsigned char>(c))) {
            ++count;
        }
    }
    return count;
}

static bool hasUppercaseAlpha(std::string_view text) {
    for (char c : text) {
        if (std::isalpha(static_cast<unsigned char>(c)) && std::isupper(static_cast<unsigned char>(c))) {
            return true;
        }
    }
    return false;
}

static bool shouldSkipLeadingNoise(unsigned char c) {
    if (std::isalpha(c)) {
        return false;
    }
    return std::isspace(c) ||
           std::isdigit(c) ||
           kLeadingNoiseChars.find(static_cast<char>(c)) != std::string_view::npos;
}

// Constructor
PLXParser::PLXParser(const std::string& path) : _filePath(path) {}

// Public methods
bool PLXParser::loadSSMLMapping(const std::string& mappingPath) {
    return _ipaGenerator.loadSSMLMapping(mappingPath);
}

bool PLXParser::parse() {
    _allStrings.clear();
    _entries.clear();

    // Try opening the file
    std::ifstream file(_filePath, std::ios::binary);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open file " << _filePath << std::endl;
        return false;
    }

    // Read all data into memory
    file.seekg(0, std::ios::end);
    size_t fileSize = static_cast<size_t>(file.tellg());
    file.seekg(0, std::ios::beg);

    std::vector<uint8_t> data(fileSize);
    file.read(reinterpret_cast<char*>(data.data()), static_cast<std::streamsize>(fileSize));
    if (!file.good() && !file.eof()) {
        std::cerr << "Error: Failed while reading file " << _filePath << std::endl;
        return false;
    }
    file.close();

    // Extract all strings
    _extractStrings(data);

    // Parse entries from strings
    _buildDictionary();

    return true;
}

const Dictionary& PLXParser::getEntries() const {
    return _entries;
}

// Private helper methods
void PLXParser::_extractStrings(const std::vector<uint8_t>& data) {
    size_t pos = 0;

    while (pos < data.size()) {
        if (data[pos] == 0x00) {
            pos++;
            continue;
        }

        // Extract null-terminated string
        std::string str;
        while (pos < data.size() && data[pos] != 0x00) {
            char c = static_cast<char>(data[pos]);
            // Filter out non-printable characters
            if (c >= 32 || c == '\t' || c == '\n' || c == '\r') {
                str += c;
            }
            pos++;
        }

        if (!str.empty() && !strTrimView(str).empty()) {
            _allStrings.push_back(str);
        }
        pos++;
    }
}

void PLXParser::_buildDictionary() {
    for (size_t i = 0; i < _allStrings.size(); ++i) {
        std::string str = _normalizeText(_allStrings[i]);

        if (str.size() < 2 ||
            startsWithAny(str, kInvalidEntryStarts) ||
            isSeeReference(str) ||
            kMetadataTerms.contains(str) ||
            (std::isdigit(static_cast<unsigned char>(str.front())) && str.size() < 5)) {
            continue;
        }

        if (i + 2 < _allStrings.size()) {
            std::string possibleTerm = str;
            std::string spanishTranslation = _normalizeText(_allStrings[i + 1]);
            std::string englishTranslation = _normalizeText(_allStrings[i + 2]);

            if (!_isValidTerm(possibleTerm, spanishTranslation, englishTranslation)) {
                continue;
            }

            bool nextIsNotMetadata = _isValidTranslation(spanishTranslation);
            bool thirdIsNotMetadata = _isValidTranslation(englishTranslation);

            if (nextIsNotMetadata && thirdIsNotMetadata) {
                _entries[possibleTerm] = {
                    spanishTranslation + " / " + englishTranslation,
                    _getIPAForTerm(possibleTerm)
                };
                i += 2;
            }
        }
    }
}

std::string PLXParser::_getIPAForTerm(const std::string& term) const {
    return _ipaGenerator.generateForTerm(term);
}

bool PLXParser::_isValidTerm(const std::string& term, const std::string& spanish, const std::string& english) const {
    if (term.size() < 3 || hasWhitespace(term) || !std::isalnum(static_cast<unsigned char>(term.front()))) {
        return false;
    }

    const size_t uppercase = countUppercase(term);
    if (uppercase > term.size() / 2) {
        return false;
    }

    if (countDigits(term) > term.size() / 3) {
        return false;
    }

    if (spanish.size() < 3 || english.size() < 3 || isSeeReference(spanish) || isSeeReference(english)) {
        return false;
    }

    if (hasUppercaseAlpha(term) && uppercase > 0) {
        return false;
    }

    return true;
}

bool PLXParser::_isValidTranslation(const std::string& trans) const {
    if (trans.size() < 3) {
        return false;
    }

    if (startsWithAny(trans, kInvalidTranslationStarts) || startsWithAny(trans, kInvalidSymbolStarts)) {
        return false;
    }

    if (std::isdigit(static_cast<unsigned char>(trans[0])) &&
        trans.size() > 1 &&
        std::isalpha(static_cast<unsigned char>(trans[1]))) {
        return false;
    }

    if (kInvalidTranslations.contains(trans)) {
        return false;
    }

    if (isSeeReference(trans)) {
        return false;
    }

    return true;
}

std::string PLXParser::_normalizeText(std::string_view str) const {
    std::string cleaned = strTrim(str);
    size_t start = 0;

    while (start < cleaned.size()) {
        unsigned char c = static_cast<unsigned char>(cleaned[start]);
        if (!shouldSkipLeadingNoise(c)) {
            break;
        }
        ++start;
    }

    cleaned = strTrim(cleaned.substr(start));
    cleaned = _stripLeadingAnnotation(cleaned);
    return strCollapseWhitespace(cleaned);
}

std::string PLXParser::_stripLeadingAnnotation(std::string_view str) const {
    std::string cleaned = strTrim(str);

    while (cleaned.size() > 3 && std::isalpha(static_cast<unsigned char>(cleaned[0])) && cleaned[1] == '(') {
        size_t closeParen = cleaned.find(')');
        if (closeParen == std::string::npos) {
            break;
        }

        cleaned = strTrim(cleaned.substr(closeParen + 1));
    }

    return cleaned;
}

