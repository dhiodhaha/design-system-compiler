#!/usr/bin/env bash
# usage: fetch.sh <outName> <depth> <pageId>[,<pageId>...]
set -u
OUT="$1"; DEPTH="$2"; IDS="$3"
ROOT=/home/dhio/untitleduireact/.design-compiler/references/figma
JSON_IDS=$(node -e 'const a=process.argv[1].split(",");console.log(JSON.stringify(a))' "$IDS")
RESP=$(composio execute FIGMA_GET_FILE_NODES -d "{\"file_key\":\"sLqnzw7tFXpuPA1TbqsjZx\",\"ids\":$JSON_IDS,\"depth\":$DEPTH}" 2>&1)
echo "$RESP" > "$ROOT/tmp/$OUT.resp.json"
FP=$(echo "$RESP" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.outputFilePath||"")}catch(e){console.log("")}})')
if [ -z "$FP" ]; then echo "NO_OFFLOAD $OUT :: $RESP"; exit 1; fi
cp "$FP" "$ROOT/raw/$OUT.json"
echo "OK $OUT bytes=$(wc -c < "$ROOT/raw/$OUT.json")"
