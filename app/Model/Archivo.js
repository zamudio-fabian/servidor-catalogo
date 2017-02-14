'use strict'

const Lucid = use('Lucid')

class Archivo extends Lucid {

  static get table () {
      return 'archivos'
  }

  pares () {
    return this.belongsToMany('App/Model/Par','archivo_par', 'hash', 'archivo_hash')
  }

}

module.exports = Archivo
