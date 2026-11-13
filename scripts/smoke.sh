#!/usr/bin/env bash
# scripts/smoke.sh — prueba rápida de integración contra un backend YA corriendo.
# Verifica salud, login por rol, 401 sin token, permisos y un caso creado/borrado.
# Uso:  bash scripts/smoke.sh [URL_API]      (por defecto http://localhost:3000/api)
# Requiere la BD con datos de demostración (npm run db:seed con SEED_DEMO_DATA=true).
API="${1:-http://localhost:3000/api}"
FAILS=0

# status <método> <ruta> [token] [json]  -> imprime solo el código HTTP
status() {
  local m="$1" p="$2" t="$3" d="$4"
  curl -s -o /dev/null -w '%{http_code}' -X "$m" "$API$p" \
    ${t:+-H "Authorization: Bearer $t"} ${d:+-H 'Content-Type: application/json' -d "$d"}
}
# token <usuario> <clave>
token() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" |
    node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{console.log(JSON.parse(s).data.token||"")}catch{console.log("")}})'
}
# check <descripción> <esperado> <obtenido>
check() {
  if [ "$2" = "$3" ]; then echo "  OK    $1"; else echo "  FALLA $1 (esperado $2, obtenido $3)"; FAILS=$((FAILS+1)); fi
}

echo "API: $API"
check "GET /health (público)" 200 "$(status GET /health)"

ADMIN=$(token admin admin123); COORD=$(token coordinador coord123); DOC=$(token docente docente123)
check "login admin devuelve token"        yes "$([ -n "$ADMIN" ] && echo yes || echo no)"
check "login coordinador devuelve token"  yes "$([ -n "$COORD" ] && echo yes || echo no)"
check "login docente devuelve token"      yes "$([ -n "$DOC" ] && echo yes || echo no)"
check "login con clave mala = 401"        401 "$(status POST /auth/login '' '{"username":"admin","password":"mala"}')"

check "sin token = 401"                   401 "$(status GET /students)"
check "token falso = 401"                 401 "$(status GET /students basura.falso.token)"
check "docente lista estudiantes"         200 "$(status GET /students "$DOC")"
check "docente NO ve reportes = 403"      403 "$(status GET '/reports/course?grade=QUINTO&group=1' "$DOC")"
check "docente NO ve usuarios = 403"      403 "$(status GET /users "$DOC")"
check "coordinador ve reportes"           200 "$(status GET '/reports/course?grade=QUINTO&group=1' "$COORD")"
check "coordinador NO ve usuarios = 403"  403 "$(status GET /users "$COORD")"
check "admin ve usuarios"                 200 "$(status GET /users "$ADMIN")"

AYER=$(date -d 'yesterday' +%F)   # el contrato exige la fecha en formato AAAA-MM-DD
BODY="{\"studentId\":1,\"title\":\"Caso smoke\",\"category\":\"CONVIVENCIA\",\"date\":\"$AYER\",\"description\":\"prueba\"}"
ID=$(curl -s -X POST "$API/cases" -H "Authorization: Bearer $COORD" -H 'Content-Type: application/json' -d "$BODY" |
  node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{console.log(JSON.parse(s).data.id)}catch{console.log("")}})')
check "coordinador crea un caso"          yes "$([ -n "$ID" ] && echo yes || echo no)"
check "coordinador NO borra casos = 403"  403 "$(status DELETE "/cases/$ID" "$COORD")"
check "admin borra el caso"               200 "$(status DELETE "/cases/$ID" "$ADMIN")"

echo; [ "$FAILS" -eq 0 ] && echo "Todo bien." || echo "$FAILS verificación(es) fallaron."
exit "$FAILS"
