#pragma once

#include <optional>
#include <string>

class TextEncoding {
public:

    /**
     * @brief stripUtf8Bom
     * Usage: std::string cleaned = TextEncoding::stripUtf8Bom(str);
     * Removes the UTF-8 Byte Order Mark (BOM) from the beginning of a string if it is present.
     * The UTF-8 BOM is a sequence of bytes (0xEF, 0xBB, 0xBF) that may appear at the start of a UTF-8 encoded file.
     * @param value The string from which to remove the UTF-8 BOM.
     * @return The input string with the UTF-8 BOM removed if it was present, otherwise returns the original string.
     */
	static std::string stripUtf8Bom(std::string value);
	
    /**
     * @brief isValidUtf8
     * Usage: if (TextEncoding::isValidUtf8(str)) { ... }
     * Checks if a given string is valid UTF-8.
     * @param text The string to check.
     * @return true if the string is valid UTF-8, false otherwise.
     */
    static bool isValidUtf8(const std::string& text);
	
    /**
     * @brief decodeWindows1252ToUtf8
     * Usage: std::string utf8 = TextEncoding::decodeWindows1252ToUtf8(bytes);
     * Decodes a string from Windows-1252 encoding to UTF-8.
     * @param bytes The string in Windows-1252 encoding.
     * @return The string converted to UTF-8.
     */
    static std::string decodeWindows1252ToUtf8(const std::string& bytes);
	
    /**
     * @brief readTextAutoDecode
     * Usage: std::optional<std::string> text = TextEncoding::readTextAutoDecode(filePath);
     * Reads a text file and automatically decodes its content to UTF-8.
     * @param filePath The path to the text file.
     * @return An optional containing the decoded text if successful, or std::nullopt if an error occurred.
     */
    static std::optional<std::string> readTextAutoDecode(const std::string& filePath);

private:
	
    /**
     * @brief appendUtf8
     * Usage: TextEncoding::appendUtf8(out, codePoint);
     * Appends a UTF-8 encoded representation of a Unicode code point to a string.
     * @param out The string to which the UTF-8 encoded code point will be appended.
     * @param codePoint The Unicode code point to encode and append.
     */
    static void appendUtf8(std::string& out, unsigned int codePoint);
};
