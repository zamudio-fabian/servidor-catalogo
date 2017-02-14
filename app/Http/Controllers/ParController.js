'use strict'

const Par = use('App/Model/Par')
const Database = use('Database')
const Env = use('Env');

class ParController {

  * index (request, response) {
      yield response.sendView('par.index')
  }

  * truncateAll () {
      yield Database.table('archivo_par').delete()
      yield Database.table('pares').delete()
      yield Database.table('archivos').delete()
  }

  * nuevaConexion (ip, puerto, catalogo){
    const par = yield Par.findBy('ip', ip)
    if(par == null) {
      const par = new Par()
    }
    par.ip = ip
    par.puerto = puerto
    par.catalogo_conectado = catalogo
    yield par.save()
    return par
  }

  * getDbPares(){
    const pares = yield Par.all()
    return pares
  }

  * getCantidadParesConectados (){
    const paresConectados = yield Database
      .from('pares')
      .where('catalogo_conectado', Env.get('HOST'))
      .count()
    return paresConectados[0]['count(*)']
  }


}

module.exports = ParController
