'use strict'

const Schema = use('Schema')

class ArchivosTableSchema extends Schema {

  up () {
    this.create('archivos', (table) => {
      table.increments()
      table.string('hash').unique()
      table.bigInteger('size')
      table.string('nombre')
      table.timestamps()
    })
  }

  down () {
    this.drop('archivos')
  }

}

module.exports = ArchivosTableSchema
