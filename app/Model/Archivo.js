'use strict'

const Lucid = use('Lucid')

class Archivo extends Lucid {

  static get table () {
      return 'archivos'
  }

  pares () {
    return this.belongsToMany('App/Model/Par')
  }

}

module.exports = Archivo
