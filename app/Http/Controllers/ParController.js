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
      instanciaPar.online = 1
      instanciaPar.catalogo_conectado = catalogo
      yield instanciaPar.save()
      return instanciaPar
    }
    else {
      par.puerto = puerto
      par.online = 1
      par.catalogo_conectado = catalogo
      yield par.save();
      return par
    }
  }

  * getDbPares(){
    const pares = yield Par.all()
    return pares
  }

  * getCantidadParesConectados (){
    const paresConectados = yield Database
      .from('pares')
      .where({ online: 1 , catalogo_conectado:Env.get('HOST')})
      .count()
    return paresConectados[0]['count(*)']
  }

  * desconexion (ip){
    const instanciaPar = new Par()
    const par = yield Par.findBy('ip', ip)
    yield Database
      .from('pares')
      .where('ip', ip)
      .update({ online: 0 , catalogo_conectado:''})
  }

}

module.exports = ParController
