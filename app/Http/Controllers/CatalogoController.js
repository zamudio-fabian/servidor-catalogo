'use strict'

const Archivo = use('App/Model/Archivo')
const Par = use('App/Model/Par')
const Database = use('Database')
const Env = use('Env');

class CatalogoController {
  
  * index (request, response) {
    const archivos = yield Archivo.all()
    archivos.forEach(function(archivo){
      archivo.size = (archivo.size / (1024 * 1024)).toFixed(2);
      archivo.size = archivo.size+' MB'
    });
    const pares = yield Par.all()
    yield response.sendView('catalogo.index', {
        archivos: archivos.toJSON(),
        pares: pares.toJSON(),
        ip: Env.get('HOST'),
        puerto: Env.get('PORT')
    })
  }

  * nuevoArchivo (ip, archivo){
    const instanciaArchivo = new Archivo()
    const par = yield Database
      .select('id')
      .from('pares')
      .where('ip', ip)
    var idPar = [par[0].id]
    const archivoExistente = yield Archivo.findBy('hash', archivo.hash)
    if(archivoExistente == null) {
      instanciaArchivo.nombre = archivo.nombre
      instanciaArchivo.hash = archivo.hash
      instanciaArchivo.size = archivo.size
      yield instanciaArchivo.save()
      yield instanciaArchivo.pares().attach(idPar)
      return 0
    }
    else {
      const pares = (yield archivoExistente.pares().fetch()).toJSON();
      var ban = false;
      for (var i in pares) {
        if (pares[i].id == par[0].id) {
          ban = true;
        }
      }
      if (!ban) {
        yield archivoExistente.pares().attach(idPar)
        return 1
      }
      else {
        return 2
      }
    }
  }

  * eliminarArchivo (ip, hash){
    const archivo  = yield Archivo.findBy('hash', hash)
    const par  = yield Par.findBy('ip', ip)
    var idPar = [par.id]
    if (archivo != null) {
      yield archivo.pares().detach(idPar)
      var peers = yield this.getCantidadPeersArchivo(archivo.id)
      if (peers == 0) {
        yield archivo.delete()
        return 1
      }
      else {
        return 2
      }
    }
    else {
      return 0
    }
  }


  * replicacionDb(pares, archivos, archivoPar){
    yield Database.transaction(function * (trx) {
      yield trx.delete().from('pares')
      yield trx.delete().from('archivos')
      yield trx.delete().from('archivo_par')
      yield trx.delete({name: 'pares'}).from('sqlite_sequence')
      yield trx.delete({name: 'archivos'}).from('sqlite_sequence')
      yield trx.delete({name: 'archivo_par'}).from('sqlite_sequence')
      for (var i in pares) {
        yield trx.insert({ip: pares[i].ip,
          puerto: pares[i].puerto,
          catalogo_conectado: pares[i].catalogo_conectado})
          .into('pares')
      }
      for (var i in archivos) {
        yield trx.insert({nombre: archivos[i].nombre,
          hash: archivos[i].hash})
          .into('archivos')
      }
      for (var i in archivoPar) {
        yield trx.insert({archivo_id: archivoPar[i].archivo_id,
          par_id: archivoPar[i].par_id})
          .into('archivo_par')
      }
    })
  }

  * getDbArchivos(){
    const archivos = yield Archivo.all()
    return archivos
  }

  * getDbArchivoPar(){
    const archivoPar = yield Database
      .table('archivo_par')
    return archivoPar
  }

  * buscarArchivo (archivo){
    const archivosBuscados = yield Database
      .from('archivos')
      .where('nombre','LIKE', '%'+archivo+'%')
    if (archivosBuscados != null) {
      var result = []
      for (var i in archivosBuscados) {
        var archivo = new Object()
        archivo.nombre = archivosBuscados[i].nombre
        archivo.size = archivosBuscados[i].size
        archivo.hash = archivosBuscados[i].hash
        archivo.peers = yield this.getCantidadPeersArchivo(archivosBuscados[i].id)
        archivo.id = archivosBuscados[i].id
        if (archivo.peers > 0) {
          result.push(archivo)
        }
      }
      return result
    }
    else {
      return null
    }
  }

  * getParesArchivo (hash){
    var result = []
    const archivoBuscado = yield Archivo.findBy('hash', hash)
    if(archivoBuscado != null){
      const pares = (yield archivoBuscado.pares().fetch()).toJSON();
        if (pares.length > 0) {
          for (var i in pares) {
            var par = new Object()
            par.ip = pares[i].ip
            result.push(par)
          }
          return result
        }
        else {
          return null
        }
    }else{
      return null
    }
    
  }

  * getCantidadPeersArchivo (id){
    const archivo = yield Archivo.find(id)
    var peers = 0
    var pares = (yield archivo.pares().fetch()).toJSON();
    for (var j in pares) {
      peers++
    }
    return peers
  }

  * desconexionPar (ip){
    const instanciaPar = new Par()
    const par = yield Par.findBy('ip', ip)
    yield Database
      .from('archivo_par')
      .where('par_id', par.id)
      .delete()
    yield Database
      .from('pares')
      .where('ip', ip)
      .delete()
    var borrarArchivos = []
    const archivos = (yield Archivo.all()).toJSON()
    for (var i in archivos) {
      var peers = yield this.getCantidadPeersArchivo(archivos[i].id)
      if (peers == 0) {
        borrarArchivos.push(archivos[i].hash)
        const archivoNoPeers = yield Archivo.findBy('id', archivos[i].id)
        yield archivoNoPeers.delete()
      }
    }
    return borrarArchivos
  }

}

module.exports = CatalogoController
