#include "ipa_generator.h"

#include "string_helpers.h"

#include <algorithm>
#include <fstream>
#include <iostream>
#include <sstream>

std::string IPAGenerator::generateFromMapping(std::string_view term,
                                              const OrthographyPhonologyMap& mapping,
                                              const UnitKeys& keys) {
    if (term.empty() || mapping.empty() || keys.empty()) {
        return "";
    }

    size_t i = 0;
    std::string phonemeChain;

    while (i < term.size()) {
        bool matched = false;

        for (const auto& key : keys) {
            if (i + key.size() <= term.size() && term.substr(i, key.size()) == key) {
                const auto it = mapping.find(key);
                if (it != mapping.end()) {
                    phonemeChain += it->second;
                }
                i += key.size();
                matched = true;
                break;
            }
        }

        if (!matched) {
            const char c = term[i];
            if (std::isalpha(static_cast<unsigned char>(c))) {
                return "";
            }
            i++;
        }
    }

    if (phonemeChain.empty()) {
        return "";
    }

    return "/" + phonemeChain + "/";
}

bool IPAGenerator::loadSSMLMapping(const std::string& mappingPath) {
    std::ifstream file(mappingPath);
    if (!file.is_open()) {
        std::cerr << "Warning: Could not open SSML mapping file " << mappingPath << std::endl;
        return false;
    }

    std::ostringstream buffer;
    buffer << file.rdbuf();
    const std::string xml = buffer.str();

    _mapping.clear();

    size_t pos = 0;
    size_t loaded = 0;
    while (true) {
        const size_t lexemeStart = xml.find("<lexeme", pos);
        if (lexemeStart == std::string::npos) {
            break;
        }

        const size_t lexemeOpenEnd = xml.find('>', lexemeStart);
        if (lexemeOpenEnd == std::string::npos) {
            break;
        }

        const size_t lexemeEnd = xml.find("</lexeme>", lexemeOpenEnd);
        if (lexemeEnd == std::string::npos) {
            break;
        }

        const std::string lexemeBlock = xml.substr(lexemeOpenEnd + 1, lexemeEnd - (lexemeOpenEnd + 1));
        const std::string grapheme = extractTagContent(lexemeBlock, "grapheme");
        const std::string phoneme = extractTagContent(lexemeBlock, "phoneme");

        if (!grapheme.empty() && !phoneme.empty()) {
            _mapping[strToLowerASCII(strTrim(grapheme))] = strTrim(phoneme);
            ++loaded;
        }

        pos = lexemeEnd + 9;
    }

    rebuildKeyCache();
    std::cout << "Loaded " << loaded << " IPA entries from SSML mapping: " << mappingPath << std::endl;
    return loaded > 0;
}

std::string IPAGenerator::generateForTerm(std::string_view term) const {
    if (_mapping.empty()) {
        return "";
    }

    const std::string normalized = strToLowerASCII(strTrim(term));
    if (normalized.empty()) {
        return "";
    }

    const auto direct = _mapping.find(normalized);
    if (direct != _mapping.end()) {
        return direct->second;
    }

    return IPAGenerator::generateFromMapping(normalized, _mapping, _keys);
}

bool IPAGenerator::hasMapping() const {
    return !_mapping.empty();
}

std::string IPAGenerator::extractTagContent(std::string_view block, std::string_view tag) {
    const std::string openTag = "<" + std::string(tag);
    const std::string closeTag = "</" + std::string(tag) + ">";

    const size_t openStart = block.find(openTag);
    if (openStart == std::string::npos) {
        return "";
    }

    const size_t openEnd = block.find('>', openStart);
    if (openEnd == std::string::npos) {
        return "";
    }

    const size_t closeStart = block.find(closeTag, openEnd + 1);
    if (closeStart == std::string::npos) {
        return "";
    }

    return std::string(block.substr(openEnd + 1, closeStart - (openEnd + 1)));
}

void IPAGenerator::rebuildKeyCache() {
    _keys.clear();
    _keys.reserve(_mapping.size());

    for (const auto& [grapheme, _] : _mapping) {
        _keys.push_back(grapheme);
    }

    std::sort(_keys.begin(), _keys.end(), [](const std::string& a, const std::string& b) {
        if (a.size() != b.size()) {
            return a.size() > b.size();
        }
        return a < b;
    });
}
