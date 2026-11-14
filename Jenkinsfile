pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Obtener codigo de GitHub') {
            steps {
                checkout scm
                echo 'Codigo fuente obtenido correctamente.'
            }
        }

        stage('Verificar estructura del proyecto') {
            steps {
                sh '''
                    test -f package.json
                    test -f server.js
                    test -f Dockerfile
                    test -f docker-compose.yml
                    test -f nginx/default.conf
                    test -f nginx/Dockerfile
                '''
                echo 'Estructura del proyecto SMART HOUSE verificada.'
            }
        }

        stage('Verificar configuracion Docker') {
            steps {
                sh '''
                    grep -q "smart-house-network" docker-compose.yml
                    grep -q "smart-house-backend" docker-compose.yml
                    grep -q "smart-house-frontend" docker-compose.yml
                '''
                echo 'Configuracion de los servicios Docker verificada.'
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