#include "csvparser.h"
#include "ipa_generator.h"
#include "plxparser.h"
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <ranges>
#include <span>
#include <string_view>

enum class InputType {
    PLX,
    CSV,
    UNKNOWN
};

InputType detectInputType(std::string_view input) {
    if (input.ends_with(".plx")) {
        return InputType::PLX;
    
    } else if (input.ends_with(".csv")) {
        return InputType::CSV;
    } else {
    return InputType::UNKNOWN;
    }
}

[[nodiscard("Extension is required to detect input type.")]] 
bool hasExtension(std::string_view path, std::string_view ext) {
    return path.ends_with(ext);
}

std::string toLowerASCII(std::string str) {
    std::ranges::transform(str, str.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return str;
}


std::string escapeJSON(const std::string& str) {
    std::string escaped;
    escaped.reserve(str.size());

    for (char c : str) {
        switch (c) {
            case '\\': escaped += "\\\\"; break;
            case '"': escaped += "\\\""; break;
            case '\b': escaped += "\\b"; break;
            case '\f': escaped += "\\f"; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 32) {
                    const char* hex = "0123456789abcdef";
                    escaped += "\\u00";
                    escaped.push_back(hex[(c >> 4) & 0x0F]);
                    escaped.push_back(hex[c & 0x0F]);
                } else {
                    escaped.push_back(c);
                }
                break;
        }
    }

    return escaped;
}

/**
 * @brief writeDictionaryJSON
 * Usage: if (writeDictionaryJSON(dict, "output.json")) { ... }
 * Writes the given dictionary to a JSON file at the specified path. The JSON
 * structure is:
 * {
 *   "dictionary": {
 *   "<term>": {"translation": "<translation>",
 *              "ipa": "<ipa>"},
 *   ...
 * }
 * @param dict The dictionary to write, mapping terms to (translation, IPA) pairs.
 * @param outputPath The path to the output JSON file.
 * @return true if the file was successfully written, false otherwise.
 * @note The output file will be overwritten if it already exists. The method 
 * does not perform any validation on the output path, so it is the caller's
 * responsibility to ensure that the path is valid and writable.
 */
[[nodiscard ("Output path must be valid and writeable.")]] 
bool writeDictionaryJSON(const Dictionary& dict, const std::string& outputPath) {
    std::ofstream file(outputPath);
    if (!file.is_open()) {
        return false;
    }

    file << "{\n";
    file << "  \"dictionary\": {\n";

    size_t count = 0;
    for (const auto& [term, data] : dict) {
        file << "    \"" << escapeJSON(term) << "\": {\n";
        file << "      \"translation\": \"" << escapeJSON(data.first) << "\",\n";
        file << "      \"ipa\": \"" << escapeJSON(data.second) << "\"\n";
        file << "    }";
        if (++count < dict.size()) {
            file << ",";
        }
        file << "\n";
    }

    file << "  }\n";
    file << "}\n";
    return true;
}

int main(int argc, char* argv[]) {
    
    // Give usage instructions if no arguments are provided
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0]
                  << " <path_to_PLX_or_CSV_file> [output_json_file] [ssml_mapping_xml]"
                  << std::endl;
        return 1;
    }

    // Check the primary input type
    const std::string primaryInput = argv[1];
    const InputType primaryKind = detectInputType(toLowerASCII(primaryInput));

    if (primaryKind == InputType::UNKNOWN) {
        std::cerr << "Error: Primary input must be a .PLX or .CSV file" << std::endl;
        return 1;
    }

    std::string outputFile = "nahuatl_dictionary.json";
    std::string ssmlMappingPath;

    // Process the remaining arguments
    for (const char* rawArg : std::span(argv + 2, static_cast<size_t>(argc - 2))) {
        const std::string arg = rawArg;
        const std::string lower = toLowerASCII(arg);

        if (hasExtension(lower, ".xml")) {
            ssmlMappingPath = arg;
        } else if (hasExtension(lower, ".json")) {
            outputFile = arg;
        } else if (outputFile == "nahuatl_dictionary.json") {
            outputFile = arg;
        }
    }

    // Parse the PLX file if needed and get the initial dictionary
    Dictionary merged;
    if (primaryKind == InputType::PLX) {
        PLXParser parser(primaryInput);

        // Load the SSML mapping for PLX-driven IPA lookup/generation.
        if (!ssmlMappingPath.empty()) {
            parser.loadSSMLMapping(ssmlMappingPath);
        }

        if (!parser.parse()) {
            return 1;
        }
        merged = parser.getEntries();
    } else {
        CSVParser parserCSV(primaryInput);
        if (!parserCSV.parse()) {
            return 1;
        }

        IPAGenerator ipaGenerator;
        if (!ssmlMappingPath.empty()) {
            ipaGenerator.loadSSMLMapping(ssmlMappingPath);
        }

        size_t inserted = 0;
        for (const auto& [term, translation] : parserCSV.getEntries()) {
            if (!merged.contains(term)) {
                merged.emplace(term, DictionaryEntry{translation, ipaGenerator.generateForTerm(term)});
                ++inserted;
            }
        }

        std::cout << "Added " << inserted << " terms from " << primaryInput << std::endl;
    }

    // Notify user once dictionary is ready
    if (writeDictionaryJSON(merged, outputFile)) {
        std::cout << "Dictionary exported to " << outputFile
                  << " (" << merged.size() << " entries)" << std::endl;
        return 0;
    }

    std::cerr << "Error: Could not write JSON output to " << outputFile << std::endl;
    return 1;
}
