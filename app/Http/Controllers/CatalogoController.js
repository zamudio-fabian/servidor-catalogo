'use strict'

const Archivo = use('App/Model/Archivo')
const Par = use('App/Model/Par')
const Database = use('Database')
const Env = use('Env');

class CatalogoController {

  * index (request, response) {
    const archivos = yield Archivo.all()
    const pares = yield Par
      .query()
      .where('online', 1)
      .fetch()
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
          online: pares[i].online,
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
        const archivoAux = yield Archivo.find(archivosBuscados[i].id)
        var peers = 0
        var pares = (yield archivoAux.pares().fetch()).toJSON();
        for (var j in pares) {
          if (pares[j].online == 1) {
            peers++
          }
        }
        archivo.nombre = archivosBuscados[i].nombre
        archivo.size = archivosBuscados[i].size
        archivo.peers = peers
        archivo.id = archivosBuscados[i].id
        result.push(archivo)
      }
      return result
    }
    else {
      return null
    }
  }

  * getParesArchivo (id){
    var result = []
    const archivoBuscado = yield Archivo.find(id)
    const pares = (yield archivoBuscado.pares().fetch()).toJSON();
    for (var i in pares) {
      if (pares[i].online == 1) {
        var par = new Object()
        par.ip = pares[i].ip
        result.push(par)
      }
    }
    return result
  }

}

module.exports = CatalogoController
