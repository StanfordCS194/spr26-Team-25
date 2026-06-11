#pragma once

#include <cctype>
#include <string>
#include <string_view>

/**
 * @brief strTrimView
 * Usage: std::string_view trimmed = strTrimView(str);
 * Trims leading and trailing whitespace from a string view. The default set of
 * whitespace characters includes space, tab, newline, and carriage return. The
 * function returns a view into the original string, so no new string is created.
 * @param str The string view to trim.
 * @param whitespaces A string view containing characters to consider as whitespace.
 * @return A string view with leading and trailing whitespace removed.
 */
inline std::string_view strTrimView(std::string_view str,
                                    std::string_view whitespaces = " \t\n\r") {
    const size_t first = str.find_first_not_of(whitespaces);
    if (first == std::string_view::npos) {
        return {};
    }

    const size_t last = str.find_last_not_of(whitespaces);
    return str.substr(first, last - first + 1);
}

/**
 * @brief strTrim
 * Usage: std::string trimmed = strTrim(str);
 * Trims leading and trailing whitespace from a string. The default set of
 * whitespace characters includes space, tab, newline, and carriage return.
 * @param str The string view to trim.
 * @param whitespaces A string view containing characters to consider as whitespace.
 * @return A new string with leading and trailing whitespace removed.
 */
inline std::string strTrim(std::string_view str,
                           std::string_view whitespaces = " \t\n\r") {
    return std::string(strTrimView(str, whitespaces));
}

/**
 * @brief strToLowerASCII
 * Usage: std::string lower = strToLowerASCII(str);
 * Converts all ASCII characters in the string to lowercase.
 * @param str The string view to convert.
 * @return A new string with all ASCII characters converted to lowercase.
 */
inline std::string strToLowerASCII(std::string_view str) {
    std::string lowered(str);
    for (char& c : lowered) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return lowered;
}

/**
 * @brief strCollapseWhitespace
 * Usage: std::string collapsed = strCollapseWhitespace(str);
 * Collapses consecutive whitespace characters in the string into a single space.
 * The default set of whitespace characters includes space, tab, newline, and
 * carriage return. The function also trims leading and trailing whitespace.
 * @param str The string view to process.
 * @param whitespaces A string view containing characters to consider as whitespace.
 * @return A new string with consecutive whitespace collapsed and trimmed.
 */
inline std::string strCollapseWhitespace(std::string_view str,
                                         std::string_view whitespaces = " \t\n\r") {
    std::string result;
    result.reserve(str.size());

    bool inWhitespace = false;
    for (char c : str) {
        if (whitespaces.find(c) != std::string_view::npos) {
            if (!inWhitespace && !result.empty()) {
                result.push_back(' ');
            }
            inWhitespace = true;
        } else {
            result.push_back(c);
            inWhitespace = false;
        }
    }

    return strTrim(result, whitespaces);
}
