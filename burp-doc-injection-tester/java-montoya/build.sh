#!/usr/bin/env bash
# Build the extension JAR with plain javac + jar (no Gradle/Maven needed).
# The Montoya API is 'provided' by Burp at runtime, so it is NOT bundled.
set -euo pipefail
cd "$(dirname "$0")"

VER="${MONTOYA_VER:-2025.12}"
API="lib/montoya-api-${VER}.jar"
OUT="build/classes"
JAR="doc-injection-tester.jar"

if [ ! -f "$API" ]; then
  echo "[*] Montoya API jar not found, downloading $VER ..."
  mkdir -p lib
  curl -sSfL --max-time 120 -o "$API" \
    "https://repo1.maven.org/maven2/net/portswigger/burp/extensions/montoya-api/${VER}/montoya-api-${VER}.jar"
fi

rm -rf "$OUT"
mkdir -p "$OUT"

echo "[*] Compiling..."
find src/main/java -name '*.java' > build/sources.txt
javac -Xlint:all -cp "$API" -d "$OUT" @build/sources.txt

echo "[*] Copying resources (ServiceLoader entry point)..."
cp -r src/main/resources/. "$OUT"/

echo "[*] Packaging $JAR ..."
jar --create --file "$JAR" -C "$OUT" .

echo "[+] Built: $(pwd)/$JAR"
echo "    Load it in Burp: Extensions > Add > Type: Java > select the jar."
