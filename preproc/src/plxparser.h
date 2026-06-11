/**
 * Filename: plxparser.h
 * Description: This file declares the PLXParser class, which is responsible for
 * parsing .PLX files.
 * Author: Adam Nalley
 * Date: 05/11/2026
 * This code was primarily coded with Github Copilot, with some manual edits.
 */
#pragma once

#include "ipa_generator.h"

#include <cstdint>
#include <map>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

using DictionaryEntry = std::pair<std::string, std::string>;
using Dictionary = std::map<std::string, DictionaryEntry>;

class PLXParser {

public:

    /**
     * @brief PLXParser
     * Constructs a PLXParser for the given file path.
     * @param path The path to the .PLX file to parse.
     * @throws std::runtime_error if the file cannot be opened or read.
     */
    explicit PLXParser(const std::string& path);

    /**
     * @brief ~PLXParser
     * Destructor for PLXParser.
     */
    ~PLXParser() = default;

    // Copy Constructor Deleted
    PLXParser(const PLXParser&) = delete;
    PLXParser& operator=(const PLXParser&) = delete;

    // Move Constructor and Assignment
    PLXParser(PLXParser&&) = default;
    PLXParser& operator=(PLXParser&&) = default;

    /**
     * @brief loadSSMLMapping
     * Usage: if (parser.loadSSMLMapping("mapping.xml")) { ... }
     * Loads an SSML mapping file used to generate IPA from grapheme sequences.
     * @param mappingPath The path to the SSML mapping XML file.
     * @return true if the mapping was successfully loaded, false otherwise.
     */
    bool loadSSMLMapping(const std::string& mappingPath);

    /**
     * @brief parse
     * Usage: if (parser.parse()) { ... }
     * Parses the .PLX file specified in the constructor, extracting terms, 
     * translations, and IPA data.
     * @return true if parsing was successful, false otherwise.
     */
    bool parse();

    /**
     * @brief getEntries
     * Usage: const Dictionary& dict = parser.getEntries();
     * Returns a const reference to parsed entries.
     * Each entry maps a term to a pair of (translation, IPA). The returned
     * reference is valid as long as the PLXParser instance exists.
     * @return A const reference to parsed entries.
     */
    const Dictionary& getEntries() const;

private:

    /**
     * @brief _extractStrings
     * Usage: _extractStrings(data);
     * Extracts all null-terminated strings from the raw .PLX file data and 
     * stores them in _allStrings.
     * @param data The raw byte data read from the .PLX file.
     * @pre The data vector must contain the contents of a .PLX file.
     * @post The _allStrings vector is populated with all null-terminated strings
     *       found in the data.
     */
    void _extractStrings(const std::vector<uint8_t>& data);

    /**
     * @brief _buildDictionary
     * Usage: _buildDictionary();
     * Processes the extracted strings in _allStrings to identify valid dictionary
     * entries.
     * The method applies several heuristics to filter out non-entry strings, 
     * such as strings that are too short, contain invalid characters, or do not
     * have corresponding translations.
     * @pre The _allStrings vector must be populated with the strings extracted 
     *       from the .PLX file.
     * @post The _entries map is populated with valid terms as keys and their
     *     corresponding translations and IPA transcriptions as values.
     */
    void _buildDictionary();

    /**
     * @brief _getIPAForTerm
     * Usage: std::string ipa = _getIPAForTerm(term);
    * Generates the IPA transcription for a given term using the internal IPA
    * mapping service.
     * @param term The term for which to generate the IPA transcription.
     * @return The IPA transcription for the term.
     */
    std::string _getIPAForTerm(const std::string& term) const;

    /**
     * @brief _isValidTerm
     * Usage: bool valid = _isValidTerm(term, spanish, english);
     * Determines if a given term, along with its Spanish and English translations,
     * meets the criteria to be considered a valid dictionary entry. The method 
     * checks for various conditions such as length, character content, presence 
     * of certain markers, and validity of translations.
     * @param term The term to validate.
     * @param spanish The Spanish translation of the term.
     * @param english The English translation of the term.
     * @return true if the term is valid according to the criteria, false otherwise.
     */
    bool _isValidTerm(const std::string& term, const std::string& spanish, const std::string& english) const;
    
    /**
     * @brief _isValidTranslation
     * Usage: bool valid = _isValidTranslation(translation);
     * Determines if a given translation string is valid based on certain 
     * heuristics.
     * @param trans The translation string to validate.
     * @return true if the translation is valid according to the heuristics, false otherwise.
     */
    bool _isValidTranslation(const std::string& trans) const;
    
    /**
     * @brief _stripLeadingAnnotation
     * Usage: std::string cleaned = _stripLeadingAnnotation(str);
     * Removes leading annotations from a string. Annotations are defined as 
     * sequences that start with an alphabetic character followed by an opening 
     * parenthesis, and end with a closing parenthesis.
     * @param str The string from which to strip leading annotations.
     * @return The string with leading annotations removed.
     */
    std::string _stripLeadingAnnotation(std::string_view str) const;
    std::string _normalizeText(std::string_view str) const;
    
    // Filepath of the .PLX file to parse
    std::string _filePath {};

    // The main dictionary of parsed entries: term -> (translation, IPA)
    Dictionary _entries {};

    // All strings extracted from the .PLX file
    std::vector<std::string> _allStrings {};

    // Generic IPA service loaded from SSML mapping XML.
    IPAGenerator _ipaGenerator {};
};
