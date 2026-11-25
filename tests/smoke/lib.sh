# Funcions comunes dels scripts de smoke (les carrega cada script amb `source`).
# Cada script és independent: inicia les seves sessions i fa servir les dades dels seeds, mai el que
# ha creat un altre script. Necessita API_URL (p. ex. http://localhost:3000/api), curl i jq.
set -euo pipefail
: "${API_URL:?Falta API_URL (p. ex. http://localhost:3000/api)}"

# Comptes i dades dels seeds (db/seeds).
PASSWORD=Bloop4-dev-2026
ALTAVOZ=d0000000-0000-4000-8000-000000000001
JAIMA=d0000000-0000-4000-8000-000000000014
SEEDED=f0000000-0000-4000-8000-000000000001     # reserva confirmada del 15/06/2030
IN_TRANSIT=f0000000-0000-4000-8000-000000000006 # reserva amb els lliuraments en curs (20/07/2030)
PENDING=f0000000-0000-4000-8000-000000000007    # reserva pendent de pagament (08/08/2030)
FINISHED=f0000000-0000-4000-8000-000000000004   # reserva finalitzada del client (octubre de 2026)
# Serveis dels seeds, tots del rider d'exemple (rider@example.com).
SONIDO_DELIVERY=d2000000-0000-4000-8000-000000000001  # lliurament de Sonido del 15/06, assignat
SONIDO_PICKUP=d2000000-0000-4000-8000-000000000002    # recollida de Sonido del 16/06, assignada (franja moguda)
TURIA_DELIVERY=d2000000-0000-4000-8000-000000000003   # lliurament de Mobiliario del 14/06, assignat
TURIA_PICKUP=d2000000-0000-4000-8000-000000000004     # recollida de Mobiliario del 17/06, pendent
MAP_DELIVERY=d2000000-0000-4000-8000-000000000010     # lliurament de Sonido del 20/07, en curs
PROOF_DELIVERY=d2000000-0000-4000-8000-000000000011   # lliurament de Mobiliario del 20/07, en curs
PROOF_ITEM=f1000000-0000-4000-8000-000000000009       # cadires d'aquest lliurament

expect() { # expect <descripció> <valor obtingut> <valor esperat>
  if [ "$2" != "$3" ]; then echo "✗ $1: s'esperava $3 i s'ha obtingut $2"; exit 1; fi
  echo "✓ $1"
}

# login <correu>: inicia sessió i escriu el camí del fitxer de galetes.
login() {
  local jar
  jar=$(mktemp)
  curl -fsS -c "$jar" -o /dev/null -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}"
  echo "$jar"
}

# status <args de curl…>: només el codi HTTP de la resposta.
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
