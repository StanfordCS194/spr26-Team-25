#include "csvparser.h"

#include "string_helpers.h"
#include "text_encoding.h"

#include <iostream>
#include <sstream>
#include <string_view>
#include <vector>

std::vector<std::string> CSVParser::parseCSVRow(std::string_view line) {
    std::vector<std::string> fields;
    fields.reserve(4);
    std::string current;
    bool inQuotes = false;

    for (size_t i = 0; i < line.size(); ++i) {
        const char c = line[i];

        if (c == '"') {
            if (inQuotes && i + 1 < line.size() && line[i + 1] == '"') {
                current.push_back('"');
                ++i;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (c == ',' && !inQuotes) {
            fields.emplace_back(strTrim(current));
            current.clear();
            continue;
        }

        current.push_back(c);
    }

    fields.emplace_back(strTrim(current));
    return fields;
}

CSVParser::CSVParser(const std::string& path) : _filePath(path) {}

bool CSVParser::parse() {
    _entries.clear();

    const std::optional<std::string> csvText = TextEncoding::readTextAutoDecode(_filePath);
    if (!csvText.has_value()) {
        std::cerr << "Error: Could not open CSV file " << _filePath << std::endl;
        return false;
    }

    std::istringstream file(*csvText);
    std::string line;
    bool isFirstRow = true;

    while (std::getline(file, line)) {
        if (isFirstRow) {
            line = TextEncoding::stripUtf8Bom(line);
            isFirstRow = false;
        }

        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }

        if (strTrimView(line).empty()) {
            continue;
        }

        const std::vector<std::string> fields = CSVParser::parseCSVRow(line);
        if (fields.size() < 2) {
            continue;
        }

        const std::string term = strToLowerASCII(strTrim(fields.front()));
        const std::string translation = strTrim(fields[1]);

        if (term == CSVParser::kCSVHeaderTerm || term.empty() || translation.empty()) {
            continue;
        }

        _entries.try_emplace(term, translation);
    }

    return true;
}

const CSVEntries& CSVParser::getEntries() const {
    return _entries;
}
