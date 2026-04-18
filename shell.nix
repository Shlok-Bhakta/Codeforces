{
  pkgs ? import <nixpkgs> { },
}:

let
  cbot = pkgs.writeShellScriptBin "cbot" ''
    exec ${pkgs.bun}/bin/bun run ./cbot/src/index.tsx "$@"
  '';
in
pkgs.mkShell {
  packages = with pkgs; [
    bun
    python3
    gcc
    clang
    clang-tools
    lld
    mold
  cbot
  ];

  # shellHook = ''
  #       echo "cbot - Codeforces CLI tool"
  #       
  #       GCC_INCLUDE=$(echo '#include <bits/stdc++.h>' | g++ -x c++ -E -v - 2>&1 | grep '^ /' | grep 'c++.*/$' | head -1 | tr -d ' ')
  #       
  #       cat > problems/.clangd << EOF
  #   CompileFlags:
  #     Add:
  #       - "-std=c++17"
  #       - "-I$GCC_INCLUDE"
  #       - "-I$GCC_INCLUDE/x86_64-unknown-linux-gnu"
  #       - "-I$GCC_INCLUDE/backward"
  #   EOF
  # '';
  shellHook = ''
        echo "cbot - Codeforces CLI tool"

        GCC_LIB_DIR=$(dirname "$(g++ -print-file-name=libstdc++.so.6)")
        export CBOT_GCC_LIB_DIR="$GCC_LIB_DIR"
        export LD_LIBRARY_PATH="$GCC_LIB_DIR''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

        mkdir -p cbot/.cbot-cache
        cat > cbot/.cbot-cache/cbot-prelude.hpp << EOF
    #include <bits/stdc++.h>
    #ifdef LOCAL_DEBUG
    #include <cpp-dump.hpp>
    #endif
    EOF
        if [ ! -f cbot/.cbot-cache/cbot-prelude.debug.pch ] || [ cbot/.cbot-cache/cbot-prelude.hpp -nt cbot/.cbot-cache/cbot-prelude.debug.pch ] || [ cbot/cpp-dump-lib/cpp-dump.hpp -nt cbot/.cbot-cache/cbot-prelude.debug.pch ]; then
          clang++ -std=c++23 -DLOCAL_DEBUG -pipe -Icbot/cpp-dump-lib -x c++-header cbot/.cbot-cache/cbot-prelude.hpp -o cbot/.cbot-cache/cbot-prelude.debug.pch
        fi
        
        GCC_INCLUDE=$(echo '#include <bits/stdc++.h>' | g++ -x c++ -E -v - 2>&1 | grep '^ /' | grep 'c++.*/$' | head -1 | tr -d ' ')
        
        cat > problems/.clangd << EOF
    CompileFlags:
      Add:
        - "-std=c++23"
        - "-I$GCC_INCLUDE"
        - "-I$GCC_INCLUDE/x86_64-unknown-linux-gnu"
        - "-I$GCC_INCLUDE/backward"
    EOF
  '';
}
