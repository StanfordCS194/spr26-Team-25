#pragma once

#include <map>
#include <string>
#include <string_view>
#include <vector>

using OrthographyPhonologyMap = std::map<std::string, std::string>;
using UnitKeys = std::vector<std::string>;

class IPAGenerator {
public:

    /**
     * @brief loadSSMLMapping
     * Usage: if (ipaGen.loadSSMLMapping("mapping.xml")) { ... }
     * Loads an SSML mapping file that defines grapheme-to-phoneme mappings for
     * IPA generation. The mapping file should be an XML file containing <lexeme>
     * elements with <grapheme> and <phoneme> child elements.
     * @param mappingPath The path to the SSML mapping XML file.
     * @return true if the mapping was successfully loaded, false otherwise.
     */
    bool loadSSMLMapping(const std::string& mappingPath);

    /**
     * @brief generateForTerm
     * Usage: std::string ipa = ipaGen.generateForTerm(term);
     * Generates the IPA transcription for a given term using the loaded SSML
     * mapping. The method applies the grapheme-to-phoneme rules defined in the
     * mapping to produce the IPA transcription.
     * @param term The term for which to generate the IPA transcription.
     * @return The IPA transcription for the term, or an empty string if no
     * mapping is available.
     */
    std::string generateForTerm(std::string_view term) const;

    /**
     * @brief hasMapping
     * Usage: if (ipaGen.hasMapping()) { ... }
     * Checks if the IPAGenerator has a loaded SSML mapping available for
     * generating IPA transcriptions.
     * @return true if a mapping is loaded, false otherwise.
     */
    bool hasMapping() const;

private:
    /**
     * @brief generateFromMapping
     * Usage: std::string ipa = IPAGenerator::generateFromMapping(term, mapping, keys);
     * Generates the IPA transcription for a given term using the provided mapping and keys.
     * @param term The term for which to generate the IPA transcription.
     * @param mapping The grapheme-to-phoneme mapping to use.
     * @param keys The keys to use for IPA generation.
     * @return The IPA transcription for the term, or an empty string if no mapping is available.
     */
    static std::string generateFromMapping(std::string_view term,
                                           const OrthographyPhonologyMap& mapping,
                                           const UnitKeys& keys);

    /**
     * @brief extractTagContent
     * Usage: std::string content = IPAGenerator::extractTagContent(block, "grapheme");
     * Extracts the content of a specified XML tag from a given block of text.
     * The method looks for the opening and closing tags and returns the text 
     * between them, trimmed of whitespace.
     * @param block The block of text containing the XML tags.
     * @param tag The name of the XML tag to extract content from.
     * @return The content of the specified tag, or empty string if no tag.
     */
    static std::string extractTagContent(std::string_view block, std::string_view tag);
    
    /**
     * @brief rebuildKeyCache
     * Usage: ipaGen.rebuildKeyCache();
     * Rebuilds the internal cache of keys used for IPA generation. This method
     * should be called after loading a new SSML mapping to ensure that the keys
     * are up-to-date.
     */
    void rebuildKeyCache();

    // Mapping of graphemes to phonemes
    OrthographyPhonologyMap _mapping {};

    // Cached keys for IPA generation
    UnitKeys _keys {};
};
