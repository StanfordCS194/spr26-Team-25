cmake_minimum_required(VERSION 3.20)

project(preproc VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(parser
    src/main.cpp
    src/csvparser.cpp
    src/plxparser.cpp
    src/text_encoding.cpp
    lib/ipa_generator.cpp
)

target_include_directories(parser
    PRIVATE
        src
        lib
)

if(MSVC)
    target_compile_options(parser PRIVATE /W4 /permissive-)
else()
    target_compile_options(parser PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Keep executable output in a predictable location across generators.
set_target_properties(parser PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}"
)

foreach(config IN ITEMS Debug Release RelWithDebInfo MinSizeRel)
    string(TOUPPER "${config}" config_upper)
    set_target_properties(parser PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY_${config_upper} "${CMAKE_SOURCE_DIR}"
    )
endforeach()

# Also clean stale binaries in the source root if one was manually copied there.
set_property(DIRECTORY APPEND PROPERTY ADDITIONAL_CLEAN_FILES
    "${CMAKE_SOURCE_DIR}/parser.exe"
)

install(TARGETS parser
    RUNTIME DESTINATION bin
)
