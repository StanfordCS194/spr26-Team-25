# preproc

This project builds a CLI executable named `parser` using CMake.

## Requirements

- CMake 3.20+
- A C++23-capable compiler
  - Windows: MSVC (Visual Studio) or MinGW/Clang
  - Linux: GCC or Clang
  - macOS: AppleClang or LLVM Clang

## Build With CMake (recommended)

Use the following commands:

```powershell
cmake -S . -B build
cmake --build build
```


## Format
The command format is `.\parser.exe {inputDocument} {outputJSON} {ssmlMappingFile}`
  -   `inputDocument`: the primary input file (`.plx` or `.csv`)
    -   `outputJSON`: the JSON file that contains all the terms and definitions
    -   `ssmlMappingFile`: the XML file that maps orthography to IPA for the language

Note: additional CSV arguments are not supported. If you use CSV input, pass it as `inputDocument`.

### Example
Try calling:

```
.\parser.exe res\nahuatlcolors.plx outputcolors.json lib\nahuatlSSML.xml
```

This example uses a list of colors in the Nahuatl language, which is then extracted
from the PLX file and put into a JSON file that can be uploaded or queried from a
language learning app.

you can also try it with res\samplewordlist.csv and res\nahuatlall.plx