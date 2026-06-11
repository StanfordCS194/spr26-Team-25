#include "text_encoding.h"

#include <array>
#include <fstream>
#include <sstream>
#include <string_view>

static constexpr std::string_view UTF8_BOM = "\xEF\xBB\xBF";

void TextEncoding::appendUtf8(std::string& out, unsigned int codePoint) {
    if (codePoint <= 0x7F) {
        out.push_back(static_cast<char>(codePoint));
        return;
    }

    if (codePoint <= 0x7FF) {
        out.push_back(static_cast<char>(0xC0 | (codePoint >> 6)));
        out.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
        return;
    }

    out.push_back(static_cast<char>(0xE0 | (codePoint >> 12)));
    out.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
}

std::string TextEncoding::stripUtf8Bom(std::string value) {
    if (value.starts_with(UTF8_BOM)) {
        value.erase(0, UTF8_BOM.size());
    }
    return value;
}

bool TextEncoding::isValidUtf8(const std::string& text) {
    size_t i = 0;
    while (i < text.size()) {
        const unsigned char c = static_cast<unsigned char>(text[i]);
        if (c <= 0x7F) {
            ++i;
            continue;
        }

        size_t extraBytes = 0;
        if ((c & 0xE0) == 0xC0) {
            extraBytes = 1;
            if (c < 0xC2) {
                return false;
            }
        } else if ((c & 0xF0) == 0xE0) {
            extraBytes = 2;
        } else if ((c & 0xF8) == 0xF0) {
            extraBytes = 3;
            if (c > 0xF4) {
                return false;
            }
        } else {
            return false;
        }

        if (i + extraBytes >= text.size()) {
            return false;
        }

        for (size_t j = 1; j <= extraBytes; ++j) {
            const unsigned char continuation = static_cast<unsigned char>(text[i + j]);
            if ((continuation & 0xC0) != 0x80) {
                return false;
            }
        }

        i += extraBytes + 1;
    }

    return true;
}

std::string TextEncoding::decodeWindows1252ToUtf8(const std::string& bytes) {
    static constexpr std::array<unsigned int, 32> cp1252Map = {
        0x20AC, 0x0081, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
        0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008D, 0x017D, 0x008F,
        0x0090, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
        0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x009D, 0x017E, 0x0178
    };

    std::string utf8;
    utf8.reserve(bytes.size() * 2);

    for (unsigned char byte : bytes) {
        if (byte < 0x80) {
            utf8.push_back(static_cast<char>(byte));
        } else if (byte < 0xA0) {
            appendUtf8(utf8, cp1252Map[byte - 0x80]);
        } else {
            appendUtf8(utf8, byte);
        }
    }

    return utf8;
}

std::optional<std::string> TextEncoding::readTextAutoDecode(const std::string& filePath) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) {
        return std::nullopt;
    }

    std::ostringstream buffer;
    buffer << file.rdbuf();
    std::string raw = buffer.str();

    if (raw.starts_with(UTF8_BOM)) {
        return stripUtf8Bom(std::move(raw));
    }

    if (isValidUtf8(raw)) {
        return raw;
    }

    return TextEncoding::decodeWindows1252ToUtf8(raw);
}
