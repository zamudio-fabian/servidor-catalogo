'use strict'

const Env = use('Env');
const Helpers = use('Helpers')
const Config = use('Config');
var co = require('co');
var Ioc = require('adonis-fold').Ioc
var client = require('socket.io-client')
var monolog = require('monolog')
        , Logger = monolog.Logger
        , StreamHandler = monolog.handler.StreamHandler;


/**
|------------------------------------------------------------------------
|   Controllers
|------------------------------------------------------------------------
*/

var balanceadorSocket;
var CatalogoController = Ioc.make('App/Http/Controllers/CatalogoController')
var ParController = Ioc.make('App/Http/Controllers/ParController')


co(function * () {
    yield ParController.truncateAll();
})


/**
|------------------------------------------------------------------------
|   Logger
|------------------------------------------------------------------------
*/

var log = new Logger('Log')
log.pushHandler(new StreamHandler(Helpers.storagePath('Log.json'),Logger.DEBUG))
log.on("log",function(error,record,handler){
  console.log(handler.message);
});


module.exports = function (server) {

    const io = use('socket.io')(server);


    //Salas
    var catalogoRoom = io.of('/catalogo');
    var parRoom = io.of('/par');
    var otrosCatalogosRoom = io.of('/otrosCatalogos');

    /**
    |------------------------------------------------------------------------
    |   Balanceador
    |------------------------------------------------------------------------
    */
    const SYNCDELAY = 2000;
    const RECONNECTDELAY = 2000;
    const RECONNECTIONS = 2;
    var reconnect = false;
    var balanceadorActual = 0;
    var sync;

    function conexionBalanceador() {
      balanceadorSocket = client.connect('http://'+Config.get('balanceadores.ipBalanceadores')[balanceadorActual]+':'+Config.get('balanceadores.puertoBalanceadores')+'/catalogo', {
        'reconnection': true,
        'reconnectionDelay': RECONNECTDELAY,
        'reconnectionAttempts': RECONNECTIONS
      });
    }

    function getOtrosCatalogos(callback) {
      balanceadorSocket.emit('getAllOthersCatalogos', function(data) {
        callback(data);
      });
    }

    function replicacionCompleta() {
      balanceadorSocket.emit('getAllOthersCatalogos', function(data) {
        if (data.length > 0) {
          var otroCatalogoSocket = client.connect('http://'+data[0].ip+':'+Env.get('PORT')+'/otrosCatalogos');
          otroCatalogoSocket.emit('replicacionDb', function(pares, archivos, archivoPar) {
            co(function * () {
              yield CatalogoController.replicacionDb(pares, archivos, archivoPar);
              catalogoRoom.emit('agregarParesReplicados', pares);
              catalogoRoom.emit('agregarArchivosReplicados', archivos);
              log.info('Replicación completa - Catálogo IP:'+data[0].ip);
            })
            .catch(console.error);
          });
        }
      });
    }

    function eventos() {
      balanceadorSocket.on('connect', function(){
        log.info('Conexión balanceador - IP:'+Config.get('balanceadores.ipBalanceadores')[balanceadorActual]);
        co(function * () {
          var cantidadPares = yield ParController.getCantidadParesConectados();
          sync = setInterval(function(){
            co(function * () {
             var cantidadParesSync = yield ParController.getCantidadParesConectados();
             balanceadorSocket.emit('syncPares', cantidadParesSync);
             })
           }, SYNCDELAY);
          balanceadorSocket.emit('addCatalogo',{'port':Env.get('PORT'),'pares':cantidadPares});
          if (!reconnect) {
            replicacionCompleta();
          }
        })
        .catch(console.error);
      });

      balanceadorSocket.on('reconnecting', function(numero){
        log.err('Intento de reconexión '+numero+' - IP:'+Config.get('balanceadores.ipBalanceadores')[balanceadorActual]);
      });

      balanceadorSocket.on('reconnect_failed', function(){
        log.err('Reconexión fallida - IP:'+Config.get('balanceadores.ipBalanceadores')[balanceadorActual]);
        balanceadorActual++;
        if (balanceadorActual == Config.get('balanceadores.ipBalanceadores').length) {
          balanceadorActual = 0;
        }
        conexionBalanceador();
        eventos();
      });

      balanceadorSocket.on('disconnect', function(){
        clearInterval(sync);
        log.err('Desconexión balanceador - IP:'+Config.get('balanceadores.ipBalanceadores')[balanceadorActual]);
        reconnect = true;
      });
    }

    if (balanceadorSocket == null) {
      conexionBalanceador();
      eventos();
    }

    /**
    |------------------------------------------------------------------------
    |   Sala Catalogo
    |------------------------------------------------------------------------
    */
    catalogoRoom.on('connection', function(socket){

      socket.on('getId', function(callback){
        callback(balanceadorSocket.id);
      });

      socket.on('getAllOthersCatalogosVista', function(callback){
        getOtrosCatalogos(function(otrosCatalogos) {
          callback(otrosCatalogos);
        });
      });

      socket.on('getPeersArchivoVista', function(hash, callback){
        var result;
        co(function * () {
          result = yield CatalogoController.getParesArchivo(hash);
          callback(result);
        })
        .catch(console.error);
      });

    });

    /**
    |------------------------------------------------------------------------
    |   Sala Par
    |------------------------------------------------------------------------
    */

    parRoom.on('connection', function(socket){


      socket.on('parConectado', function(){
        log.info('Conexión Par - IP:'+socket.request.connection.remoteAddress);
        socket.emit('conectado');
        var ip = socket.request.connection.remoteAddress;
        var puerto = socket.request.connection.remotePort;
        co(function * () {
          const result = yield ParController.nuevaConexion(ip, puerto, Env.get('HOST'));
          catalogoRoom.emit('agregarPar', result);
          balanceadorSocket.emit('addParToCatalogo');
          getOtrosCatalogos(function(otrosCatalogos) {
            for (var i in otrosCatalogos) {
              var otroCatalogoSocket = client.connect('http://'+otrosCatalogos[i].ip+':'+Env.get('PORT')+'/otrosCatalogos');
              otroCatalogoSocket.emit('replicacionNuevaConexion', ip, puerto, Env.get('HOST'));
              log.info('Replicación par conectado - IP:'+ip+' a Catálogo:'+otrosCatalogos[i].ip);
            }
          });
        })
        .catch(console.error);
      });

      socket.on('nuevoArchivo', function(archivo){
        var result
        var ip = socket.request.connection.remoteAddress;
        co(function * () {
          result = yield CatalogoController.nuevoArchivo(ip, archivo);
          if (result == 0 || result == 1) {
            if (result == 0) {
              log.info('Nuevo Archivo - IP:'+ip+'  Nombre:'+archivo.nombre+' Hash:'+archivo.hash);
              catalogoRoom.emit('nuevoArchivoVista',archivo);
            }
            if (result == 1) {
              log.info('Nuevo Par para Archivo - IP:'+ip+'  Nombre:'+archivo.nombre+' Hash:'+archivo.hash);
            }
            getOtrosCatalogos(function(otrosCatalogos) {
              for (var i in otrosCatalogos) {
                var otroCatalogoSocket = client.connect('http://'+otrosCatalogos[i].ip+':'+Env.get('PORT')+'/otrosCatalogos');
                otroCatalogoSocket.emit('replicacionNuevoArchivo', ip, archivo);
                log.info('Replicación nuevo archivo - IP:'+ip+' Nombre:'+archivo.nombre+' a Catálogo:'+otrosCatalogos[i].ip);
              }
            });
          }
          else {
            log.err('Par existente para Archivo - IP:'+ip+'  Nombre:'+archivo.nombre+' Hash:'+archivo.hash);
          }
        })
        .catch(console.error);
      });

      socket.on('sendEliminarArchivosPorPar',function(){
        var ip = socket.request.connection.remoteAddress;
        co(function * () {
          var result = yield CatalogoController.truncateFilesByPar(ip);
          for (var i in result) {
            catalogoRoom.emit('eliminarArchivoVista',result[i]);
          }
          log.info('Eliminar Archivo - IP:'+ip);
          getOtrosCatalogos(function(otrosCatalogos) {
            for (var i in otrosCatalogos) {
              var otroCatalogoSocket = client.connect('http://'+otrosCatalogos[i].ip+':'+Env.get('PORT')+'/otrosCatalogos');
              otroCatalogoSocket.emit('replicacionEliminarArchivosPorPar', ip);
              log.info('Replicación Eliminar Archivo - IP:'+ip+' a Catálogo:'+otrosCatalogos[i].ip);
            }
          });
          socket.emit('sendEliminarArchivosPorParOk');
        })
        .catch(console.error);
      });

      socket.on('buscarArchivo', function(archivo){
        log.info('Busqueda de archivo - IP:'+socket.request.connection.remoteAddress+' Nombre:'+archivo);
        var result;
        co(function * () {
          result = yield CatalogoController.buscarArchivo(archivo);
          socket.emit('archivoEncontrado', result);
        })
        .catch(console.error);
      });

      socket.on('getParesArchivo', function(hash){
        log.info('Pedido de pares de un archivo - IP:'+socket.request.connection.remoteAddress+' Hash:'+hash);
        var result;
        var fileToFind;
        co(function * () {
          console.log('Buscamos archivo');
          fileToFind = yield CatalogoController.getArchivoByHash(hash);
          console.log('Buscamos pares');
          result = yield CatalogoController.getParesArchivo(hash,socket.request.connection.remoteAddress);
          socket.emit('listadoPares', {peers:result,file:fileToFind});
          log.info('Pares para archivo HASH='+hash);
          log.info(result);
        })
        .catch(console.error);
      });

      socket.on('disconnect', function(){
        var ip = socket.request.connection.remoteAddress;
        co(function * () {
          log.info('Desconexión par - IP:'+ip);
          var result = yield CatalogoController.desconexionPar(ip);
          catalogoRoom.emit('eliminarPar', ip);
          balanceadorSocket.emit('removeParToCatalogo');
          for (var i in result) {
            catalogoRoom.emit('eliminarArchivoVista',result[i]);
          }
          getOtrosCatalogos(function(otrosCatalogos) {
            for (var i in otrosCatalogos) {
              var otroCatalogoSocket = client.connect('http://'+otrosCatalogos[i].ip+':'+Env.get('PORT')+'/otrosCatalogos');
              otroCatalogoSocket.emit('replicacionParDesconectado', ip);
              log.info('Replicación desconexión par - IP:'+ip+' a Catálogo:'+otrosCatalogos[i].ip);
            }
          });
        })
        .catch(console.error);
      });

    });

    /**
    |------------------------------------------------------------------------
    |   Sala Otros Catalogos
    |------------------------------------------------------------------------
    */

    otrosCatalogosRoom.on('connection', function(socket){

      socket.on('replicacionDb', function(callback){
        log.info('Pedido de replicación completa - IP:'+socket.request.connection.remoteAddress);
        co(function * () {
          var pares = yield ParController.getDbPares();
          var archivos = yield CatalogoController.getDbArchivos();
          var archivoPar = yield CatalogoController.getDbArchivoPar();
          callback(pares, archivos, archivoPar);
        })
        .catch(console.error);
      });

      socket.on('replicacionNuevaConexion', function(ip, puerto, catalogo){
        log.info('Conexión Replicada - IP:'+ip+' de Catálogo:'+socket.request.connection.remoteAddress);
        co(function * () {
          var nuevo = yield ParController.nuevaConexion(ip, puerto, catalogo);
          catalogoRoom.emit('agregarPar', nuevo);
        })
        .catch(console.error);
      });

      socket.on('replicacionNuevoArchivo', function(ip, archivo){
        var result;
        co(function * () {
          result = yield CatalogoController.nuevoArchivo(ip, archivo);
          if (result == 0 || result == 1) {
            if (result == 0) {
              log.info('Nuevo Archivo - IP:'+ip+'  Nombre:'+archivo.nombre+' Hash:'+archivo.hash);
              catalogoRoom.emit('nuevoArchivoVista',archivo);
            }
            if (result == 1) {
              log.info('Nuevo Par para Archivo - IP:'+ip+'  Nombre:'+archivo.nombre+' Hash:'+archivo.hash);
            }
          }
        })
        .catch(console.error);
      });

      socket.on('replicacionEliminarArchivosPorPar', function(ip){
        var result
        co(function * () {
          var result = yield CatalogoController.truncateFilesByPar(ip);
          log.info('Eliminar Archivo - IP:'+ip);
          for (var i in result) {
            catalogoRoom.emit('eliminarArchivoVista',result[i]);
          }
        })
        .catch(console.error);
      });

      socket.on('replicacionParDesconectado', function(ip){
        log.info('Desconexión par replicada- IP:'+ip+' de Catálogo:'+socket.request.connection.remoteAddress);
        co(function * () {
          var result = yield CatalogoController.desconexionPar(ip);
          catalogoRoom.emit('eliminarPar', ip);
          for (var i in result) {
            catalogoRoom.emit('eliminarArchivoVista',result[i]);
          }
        })
        .catch(console.error);
      });

    });

}
