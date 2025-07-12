cmake_minimum_required(VERSION 3.16)
project(SorynLoader)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Production build flag
option(PRODUCTION_BUILD "Build for production (excludes test files)" OFF)

# Security and optimization flags
if(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /O2 /Ob2 /DNDEBUG /MT")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /GS- /guard:cf- /sdl-")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /MANIFEST:NO /MANIFESTUAC:level='requireAdministrator'")
    
    # Production-specific flags
    if(PRODUCTION_BUILD)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /DPRODUCTION_BUILD")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /DNDEBUG")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /D_SECURE_SCL=0")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /D_ITERATOR_DEBUG_LEVEL=0")
    endif()
else()
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -DNDEBUG -static-libgcc -static-libstdc++")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fvisibility=hidden -fvisibility-inlines-hidden")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wl,--gc-sections -Wl,--strip-all")
    
    # Production-specific flags
    if(PRODUCTION_BUILD)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -DPRODUCTION_BUILD")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -DNDEBUG")
    endif()
endif()

# Define source files for production loader only
set(PRODUCTION_SOURCES
    SorynLoader.cpp
    SecurityUtils.cpp
)

# Define test files (excluded from production)
set(TEST_SOURCES
    test-loader.cpp
    validate-loader.cpp
)

# Create main executable (production)
add_executable(SorynLoader WIN32
    ${PRODUCTION_SOURCES}
)

# Link libraries for production
target_link_libraries(SorynLoader
    ws2_32
    wininet
    bcrypt
    advapi32
    kernel32
    user32
    shell32
    psapi
    iphlpapi
)

# Set properties for Windows executable
set_target_properties(SorynLoader PROPERTIES
    WIN32_EXECUTABLE TRUE
    VS_DEBUGGER_ENVIRONMENT "PATH=${CMAKE_BINARY_DIR}"
)

# Production-specific properties
if(PRODUCTION_BUILD)
    set_target_properties(SorynLoader PROPERTIES
        VS_DEBUGGER_ENVIRONMENT ""
        VS_USER_PROPS ""
    )
    
    # Strip debug symbols in production
    if(MSVC)
        set_target_properties(SorynLoader PROPERTIES
            LINK_FLAGS "/INCREMENTAL:NO /OPT:REF /OPT:ICF"
        )
    endif()
endif()

# Create resource file for version info
configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/version.rc.in"
    "${CMAKE_CURRENT_BINARY_DIR}/version.rc"
    @ONLY
)

# Add resource file to executable
target_sources(SorynLoader PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/version.rc")

# Install target (production only)
if(PRODUCTION_BUILD)
    install(TARGETS SorynLoader
        RUNTIME DESTINATION bin
        CONFIGURATIONS Release
    )
    
    # Install production files
    install(FILES 
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/.env.template"
        DESTINATION config
        RENAME "settings.template"
    )
    
    # Create production directory structure
    install(DIRECTORY 
        DESTINATION production
        FILES_MATCHING PATTERN "*.exe"
    )
endif()

# Print build information
if(PRODUCTION_BUILD)
    message(STATUS "Building SorynLoader for PRODUCTION")
    message(STATUS "Test files excluded from build")
    message(STATUS "Debug symbols stripped")
    message(STATUS "Optimization enabled")
else()
    message(STATUS "Building SorynLoader for DEVELOPMENT")
    message(STATUS "Test files available")
    message(STATUS "Debug symbols included")
endif() 