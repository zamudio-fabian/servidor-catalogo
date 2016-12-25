# Catálogo

#### Propósito

Crear un servidor encargado de mantener pares y una lista lógica de los archivos en los diferentes pares, como así tambien la replicación de nuevas conexiones y archivos. Para este propósito se utilizaron las tecnologías: NodeJs, framework AdonisJs, SQLite, Socket.io lo que nos permitió un desarrollo e independencia de cada componente del proceso.

#### Funciones

* Mantener lista lógica de la ubicación de los archivos en los diferentes pares.
* Búsqueda de archivos por nombre.
* Obtener pares que poseen X archivo.
* Replicar la lista lógica al resto de servidores de catálogos.
* Anunciar la conexión / desconexión de pares al balanceador.
* Conexión permanente con balanceador (si se cae la conexión, reintentar y enviar la cantidad de pares que tiene).

#### Requisitos

Como parte fundamental del proyecto es necesario tener instalado NodeJs (https://nodejs.org/es/) y npm para la instalación de librerías.

#### Instalación

```sh
$ git clone git@github.com:rafaalderete/Catalogo.git
$ cd Catalogo
$ npm install
$ touch .env
```

Llenar el archivo con los datos segun corresponda:

>   HOST=192.168.0.104

>   PORT=9000

>   APP_KEY=DTu137toz6dn74GGYGUpSScLvLewjpYW

>   NODE_ENV=development

>   CACHE_VIEWS=false

>   SESSION_DRIVER=cookie

>   DB_CONNECTION=sqlite

>   DB_HOST=127.0.0.1

>   DB_USER=root

>   DB_PASSWORD=

>   DB_DATABASE=adonis



```
$ ./ace migration:run
$ npm run dev
```
Archivo de configuración con las ip y puerto de los Balanceadores: config/balanceadores.js
