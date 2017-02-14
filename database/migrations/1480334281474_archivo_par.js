'use strict'

const Schema = use('Schema')

class ArchivoParTableSchema extends Schema {

  up () {
    this.create('archivo_par', (table) => {
      table.increments()
      table.integer('archivo_id')
      table.integer('par_id')
      table.timestamps()
    })
  }

  down () {
    this.drop('archivo_par')
  }

}

module.exports = ArchivoParTableSchema
