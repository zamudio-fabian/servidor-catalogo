'use strict'

const Lucid = use('Lucid')

class Par extends Lucid {

  static get table () {
      return 'pares'
  }

  archivos () {
    return this.belongsToMany('App/Model/Archivo','archivo_par', 'ip', 'par_ip')
  }

}

module.exports = Par
