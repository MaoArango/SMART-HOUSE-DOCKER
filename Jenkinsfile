pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo 'Codigo fuente obtenido correctamente.'
            }
        }

        stage('Build') {
            steps {
                sh '''
                    docker compose build backend frontend
                '''
                echo 'Imagenes Docker construidas correctamente.'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    set -eu

                    NETWORK="smart-house-test-${BUILD_NUMBER}"
                    BACKEND="smart-house-backend-test-${BUILD_NUMBER}"
                    FRONTEND="smart-house-frontend-test-${BUILD_NUMBER}"

                    cleanup() {
                        docker rm -f "$FRONTEND" "$BACKEND" >/dev/null 2>&1 || true
                        docker network rm "$NETWORK" >/dev/null 2>&1 || true
                    }

                    trap cleanup EXIT

                    docker network create "$NETWORK"

                    docker run -d \
                        --name "$BACKEND" \
                        --network "$NETWORK" \
                        --network-alias backend \
                        -e PORT=3000 \
                        smart-house-ci-backend:latest

                    echo "Esperando que el backend este disponible..."

                    READY=0
                    for i in $(seq 1 30); do
                        if docker exec "$BACKEND" node -e "require('http').get('http://127.0.0.1:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" >/dev/null 2>&1; then
                            READY=1
                            break
                        fi
                        sleep 2
                    done

                    if [ "$READY" -ne 1 ]; then
                        echo "ERROR: El backend no respondio."
                        docker logs "$BACKEND"
                        exit 1
                    fi

                    docker run -d \
                        --name "$FRONTEND" \
                        --network "$NETWORK" \
                        smart-house-ci-frontend:latest

                    echo "Probando comunicacion frontend-backend..."

                    docker exec "$FRONTEND" \
                        wget -qO- http://backend:3000/api/health \
                        > health-response.json

                    grep -q '"ok":true' health-response.json
                    grep -q '"service":"SMART HOUSE"' health-response.json
                    grep -q '"database":"SQLite"' health-response.json

                    cat health-response.json

                    echo "Prueba de comunicacion superada."
                '''
            }
        }
    }

    post {
        success {
            echo 'Integracion continua SMART HOUSE: EXITOSA.'
        }
        failure {
            echo 'Integracion continua SMART HOUSE: FALLIDA.'
        }
    }
}