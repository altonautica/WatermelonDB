import {
  createTable,
  addColumns,
  destroyColumn,
  renameColumn,
  schemaMigrations,
  destroyTable,
  makeColumnOptional,
  makeColumnRequired,
} from './index'
import { stepsForMigration } from './stepsForMigration'

describe('schemaMigrations()', () => {
  it('returns a basic schema migrations spec', () => {
    const migrations = schemaMigrations({ migrations: [] })
    expect(migrations).toEqual({
      sortedMigrations: [],
      validated: true,
      minVersion: 1,
      maxVersion: 1,
    })

    const migrations2 = schemaMigrations({ migrations: [{ toVersion: 2, steps: [] }] })
    expect(migrations2).toEqual({
      validated: true,
      minVersion: 1,
      maxVersion: 2,
      sortedMigrations: [{ toVersion: 2, steps: [] }],
    })

    const migrations3 = schemaMigrations({ migrations: [{ toVersion: 4, steps: [] }] })
    expect(migrations3).toEqual({
      validated: true,
      minVersion: 3,
      maxVersion: 4,
      sortedMigrations: [{ toVersion: 4, steps: [] }],
    })
  })
  it('returns a complex schema migrations spec', () => {
    const migrations = schemaMigrations({
      migrations: [
        { toVersion: 7, steps: [makeColumnOptional({ table: 'comments', column: 'body'}), makeColumnRequired({ table: 'comments', column: 'body', defaultValue: ''})]},
        { toVersion: 6, steps: [destroyTable({ table: 'comments' })] },
        {
          toVersion: 5,
          steps: [renameColumn({ table: 'comments', from: 'text', to: 'body' })],
        },
        {
          toVersion: 4,
          steps: [
            addColumns({
              table: 'comments',
              columns: [{ name: 'text', type: 'string' }],
            }),
            destroyColumn({
              table: 'comments',
              column: 'body',
            }),
          ],
        },
        {
          toVersion: 3,
          steps: [
            createTable({
              name: 'comments',
              columns: [
                { name: 'post_id', type: 'string', isIndexed: true },
                { name: 'body', type: 'string' },
              ],
            }),
            addColumns({
              table: 'posts',
              columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
            }),
          ],
        },
        {
          toVersion: 2,
          steps: [
            addColumns({
              table: 'posts',
              columns: [
                { name: 'subtitle', type: 'string', isOptional: true },
                { name: 'is_pinned', type: 'boolean' },
              ],
            }),
          ],
        },
      ],
    })
    expect(migrations).toEqual({
      validated: true,
      minVersion: 1,
      maxVersion: 7,
      sortedMigrations: [
        {
          toVersion: 2,
          steps: [
            {
              type: 'add_columns',
              table: 'posts',
              columns: [
                { name: 'subtitle', type: 'string', isOptional: true },
                { name: 'is_pinned', type: 'boolean' },
              ],
            },
          ],
        },
        {
          toVersion: 3,
          steps: [
            {
              type: 'create_table',
              schema: {
                name: 'comments',
                columns: {
                  post_id: { name: 'post_id', type: 'string', isIndexed: true },
                  body: { name: 'body', type: 'string' },
                },
                columnArray: [
                  { name: 'post_id', type: 'string', isIndexed: true },
                  { name: 'body', type: 'string' },
                ],
              },
            },
            {
              type: 'add_columns',
              table: 'posts',
              columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
            },
          ],
        },
        {
          toVersion: 4,
          steps: [
            {
              type: 'add_columns',
              table: 'comments',
              columns: [{ name: 'text', type: 'string' }],
            },
            {
              type: 'destroy_column',
              table: 'comments',
              column: 'body',
            },
          ],
        },
        {
          toVersion: 5,
          steps: [
            {
              type: 'rename_column',
              table: 'comments',
              from: 'text',
              to: 'body',
            },
          ],
        },
        {
          toVersion: 6,
          steps: [
            {
              type: 'destroy_table',
              table: 'comments',
            },
          ],
        },
        {
          toVersion: 7,
          steps: [
            {
              type: 'make_column_optional',
              table: 'comments',
              column: 'body',
            },
            {
              type: 'make_column_required',
              table: 'comments',
              column: 'body',
              defaultValue: '',
            },
          ],
        },
      ],
    })
  })
  it('throws if migration spec is malformed', () => {
    expect(() => schemaMigrations({ migrations: [{}] })).toThrow('Invalid migration')
    expect(() => schemaMigrations({ migrations: [{ toVersion: 0, steps: [] }] })).toThrow(
      /minimum.*is 2/i,
    )
    expect(() => schemaMigrations({ migrations: [{ toVersion: 1, steps: [] }] })).toThrow(
      /minimum.*is 2/i,
    )
    expect(() =>
      schemaMigrations({
        migrations: [{ toVersion: 2, steps: [{ table: 'x' }] }],
      }),
    ).toThrow('Invalid migration steps')
  })
  it(`throws if there are gaps or duplicates in migrations`, () => {
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 2, steps: [] },
          { toVersion: 2, steps: [] },
        ],
      }),
    ).toThrow('duplicates')
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 5, steps: [] },
          { toVersion: 4, steps: [] },
          { toVersion: 2, steps: [] },
        ],
      }),
    ).toThrow('gaps')

    // missing migrations from 2 to x are ok
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 6, steps: [] },
          { toVersion: 5, steps: [] },
          { toVersion: 4, steps: [] },
        ],
      }),
    ).not.toThrow()

    // chronological is ok too
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 4, steps: [] },
          { toVersion: 5, steps: [] },
          { toVersion: 6, steps: [] },
        ],
      }),
    ).not.toThrow()
  })
})

describe('migration step functions', () => {
  it('throws if createTable() is malformed', () => {
    expect(() => createTable({ columns: [] })).toThrow('name')
    expect(() => createTable({ name: 'foo', columns: [{ name: 'x', type: 'blah' }] })).toThrow(
      'type',
    )
  })
  it('throws if addColumns() is malformed', () => {
    expect(() => addColumns({ columns: [{}] })).toThrow('table')
    expect(() => addColumns({ table: 'foo' })).toThrow('columns')
    expect(() => addColumns({ table: 'foo', columns: { name: 'x', type: 'blah' } })).toThrow(
      'columns',
    )
    expect(() => addColumns({ table: 'foo', columns: [{ name: 'x', type: 'blah' }] })).toThrow(
      'type',
    )
  })
  it('throws if destroyColumn() is malformed', () => {
    expect(() => destroyColumn({ column: 'foo' })).toThrow('table')
    expect(() => destroyColumn({ table: 'foo' })).toThrow('column')
  })
  it('throws if renameColumn() is malformed', () => {
    expect(() => renameColumn({ from: 'text', to: 'body' })).toThrow('table')
    expect(() => renameColumn({ table: 'foo', from: 'text' })).toThrow('to')
    expect(() => renameColumn({ table: 'foo', to: 'body' })).toThrow('from')
  })
  it('throws if destroyTable() is malformed', () => {
    expect(() => destroyTable()).toThrow('table')
  })
  it('does not allow unsafe names', () => {
    // TODO: Move to a common location with Schema/test
    ;[
      '"hey"',
      "'hey'",
      '`hey`',
      "foo' and delete * from users --",
      'id',
      '_changed',
      '_status',
      'local_storage',
      '$loki',
      '__foo',
      '__proto__',
      'toString',
      'valueOf',
      'oid',
      '_rowid_',
      'ROWID',
    ].forEach((name) => {
      // console.log(name)
      expect(() => createTable({ name: 'foo', columns: [{ name, type: 'string' }] })).toThrow(
        'name',
      )
      expect(() => createTable({ name, columns: [{ name: 'hey', type: 'string' }] })).toThrow(
        'name',
      )
      expect(() => addColumns({ table: 'foo', columns: [{ name, type: 'string' }] })).toThrow(
        'name',
      )
      expect(() => renameColumn({ table: 'foo', from: 'hey', to: name })).toThrow('name')
    })
  })
})

describe('stepsForMigration', () => {
  it('finds the right migration steps', () => {
    const step1 = addColumns({
      table: 'posts',
      columns: [
        { name: 'subtitle', type: 'string', isOptional: true },
        { name: 'is_pinned', type: 'boolean' },
      ],
    })
    const step2 = addColumns({
      table: 'posts',
      columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
    })
    const step3 = createTable({
      name: 'comments',
      columns: [
        { name: 'post_id', type: 'string', isIndexed: true },
        { name: 'body', type: 'string' },
      ],
    })

    const migrations = schemaMigrations({
      migrations: [
        { toVersion: 5, steps: [step2, step3] },
        { toVersion: 4, steps: [] },
        { toVersion: 3, steps: [step1] },
      ],
    })

    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 3 })).toEqual([step1])
    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 4 })).toEqual([step1])
    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 5 })).toEqual([
      step1,
      step2,
      step3,
    ])
    expect(stepsForMigration({ migrations, fromVersion: 3, toVersion: 5 })).toEqual([step2, step3])
    expect(stepsForMigration({ migrations, fromVersion: 3, toVersion: 4 })).toEqual([])
    expect(stepsForMigration({ migrations, fromVersion: 4, toVersion: 5 })).toEqual([step2, step3])

    // if no available steps, return null
    expect(
      stepsForMigration({
        migrations: schemaMigrations({ migrations: [] }),
        fromVersion: 1,
        toVersion: 2,
      }),
    ).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 3 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 5 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 3, toVersion: 6 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 5, toVersion: 6 })).toEqual(null)
  })
})
