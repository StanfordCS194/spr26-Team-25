#pragma once

#include <map>
#include <string>
#include <string_view>
#include <vector>

using CSVEntries = std::map<std::string, std::string>;

class CSVParser {
public:

    /**
     * @brief CSVParser
     * Constructor for CSVParser with given file path.
     * @param path The path to the CSV file to parse.
     */
    explicit CSVParser(const std::string& path);

    /**
     * @brief parse
     * Usage: if (parser.parse()) { ... }
     * Parses the CSV file specified in the constructor, extracting terms and 
     * translations. The expected CSV format is:
     * singular,plural,translation,ipa
     * Each row should have at least the 'singular' and 'translation' fields.
     * @return true if parsing was successful, false otherwise.
     */
    bool parse();
    
    /**
     * @brief getEntries
     * Usage: const CSVEntries& entries = parser.getEntries();
     * Returns a const reference to the parsed CSV entries. Each entry maps a term
     * to its translation. The returned reference is valid as long as the CSVParser
     * instance exists.
     * @return A const reference to the parsed CSV entries.
     */
    const CSVEntries& getEntries() const;

private:
    static constexpr std::string_view kCSVHeaderTerm = "singular";

    /**
     * @brief parseCSVRow
     * Usage: std::vector<std::string> fields = CSVParser::parseCSVRow(line);
     * Parses a single line of CSV text into its constituent fields, handling quoted
     * fields and escaped quotes according to standard CSV rules. The method also trims
     * whitespace from each field.
     * @param line The CSV line to parse.
     * @return A vector of parsed and trimmed fields from the CSV line.
     */
    static std::vector<std::string> parseCSVRow(std::string_view line);

    // Filepath of the CSV file to parse
    std::string _filePath {};

    // The main dictionary of parsed entries: term -> translation
    CSVEntries _entries {};
};
