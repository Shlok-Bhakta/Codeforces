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
    clang-tools
    cbot
  ];

  shellHook = ''
        echo "cbot - Codeforces CLI tool"
        
        GCC_INCLUDE=$(echo '#include <bits/stdc++.h>' | g++ -x c++ -E -v - 2>&1 | grep '^ /' | grep 'c++.*/$' | head -1 | tr -d ' ')
        
        cat > problems/.clangd << EOF
    CompileFlags:
      Add:
        - "-std=c++17"
        - "-I$GCC_INCLUDE"
        - "-I$GCC_INCLUDE/x86_64-unknown-linux-gnu"
        - "-I$GCC_INCLUDE/backward"
    EOF
  '';
}
