'use strict'

const Schema = use('Schema')

class ParesTableSchema extends Schema {

  up () {
    this.create('pares', (table) => {
      table.increments()
      table.string('ip').unique()
      table.integer('puerto')
      table.string('catalogo_conectado')
      table.timestamps()
    })
  }

  down () {
    this.drop('pares')
  }

}

module.exports = ParesTableSchema
