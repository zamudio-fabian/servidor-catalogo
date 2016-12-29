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
    const instanciaPar = new Par()
    const par = yield Par.findBy('ip', ip)
    if(par == null) {
      instanciaPar.ip = ip
      instanciaPar.puerto = puerto
      instanciaPar.catalogo_conectado = catalogo
      yield instanciaPar.save()
      return instanciaPar
    }
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

  * desconexion (ip){
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
  }

}

module.exports = ParController
