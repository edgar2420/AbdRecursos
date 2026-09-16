#!/usr/bin/env bash
# Regenera el certificado TLS autofirmado de desarrollo del SGRH.
#
# Hace falta volver a correr esto cuando:
#   - el certificado vence (se emite por 825 dias)
#   - la IP de la maquina en la red local cambia y hay que agregarla al SAN
#
# Uso: bash generar.sh [IP_ADICIONAL ...]
# Ejemplo: bash generar.sh 192.168.1.50

set -euo pipefail
cd "$(dirname "$0")"

IPS_EXTRA=("$@")

{
  echo "[req]"
  echo "default_bits       = 2048"
  echo "prompt             = no"
  echo "default_md         = sha256"
  echo "distinguished_name = dn"
  echo "x509_extensions    = v3_req"
  echo
  echo "[dn]"
  echo "C  = BO"
  echo "ST = Santa Cruz"
  echo "L  = Warnes"
  echo "O  = Laboratorios ABD LTDA"
  echo "OU = Departamento de RRHH"
  echo "CN = SGRH desarrollo"
  echo
  echo "[v3_req]"
  echo "basicConstraints = CA:FALSE"
  echo "keyUsage         = digitalSignature, keyEncipherment"
  echo "extendedKeyUsage = serverAuth"
  echo "subjectAltName   = @alt_names"
  echo
  echo "[alt_names]"
  echo "DNS.1 = localhost"
  echo "IP.1  = 127.0.0.1"
  echo "IP.2  = 192.168.0.37"
  echo "IP.3  = 192.168.2.150"
  i=4
  for ip in "${IPS_EXTRA[@]}"; do
    echo "IP.$i  = $ip"
    i=$((i + 1))
  done
} > openssl.cnf

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout sgrh-key.pem -out sgrh-cert.pem -config openssl.cnf

# El frontend usa una copia propia (angular.json resuelve rutas relativas a su proyecto).
cp sgrh-key.pem sgrh-cert.pem ../../frontend/certs/

echo
echo "Certificado regenerado. Direcciones cubiertas:"
openssl x509 -in sgrh-cert.pem -noout -ext subjectAltName
echo
echo "Reinicie el backend y el frontend para que tomen el certificado nuevo."
