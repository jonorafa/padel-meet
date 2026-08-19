import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compterPersonnesNonLues } from './unread.js'

const conv = (id, unreadCount) => ({ player: { id }, unreadCount })

test('plusieurs messages non lus d\'une meme personne comptent pour 1', () => {
  assert.equal(compterPersonnesNonLues([conv('anna', 5)]), 1)
})

test('deux personnes distinctes comptent pour 2', () => {
  assert.equal(compterPersonnesNonLues([conv('anna', 5), conv('boris', 1)]), 2)
})

test('les conversations entierement lues ne comptent pas', () => {
  assert.equal(compterPersonnesNonLues([conv('anna', 0), conv('boris', 3)]), 1)
  assert.equal(compterPersonnesNonLues([conv('anna', 0), conv('boris', 0)]), 0)
})

test('la meme personne sur deux conversations ne compte qu\'une fois', () => {
  assert.equal(compterPersonnesNonLues([conv('anna', 2), conv('anna', 7)]), 1)
})

test('entrees incompletes ou absentes : 0 plutot qu\'un plantage', () => {
  assert.equal(compterPersonnesNonLues(null), 0)
  assert.equal(compterPersonnesNonLues(undefined), 0)
  assert.equal(compterPersonnesNonLues([]), 0)
  assert.equal(compterPersonnesNonLues([{ unreadCount: 3 }]), 0, 'sans id de joueur, on n\'invente pas un interlocuteur')
  assert.equal(compterPersonnesNonLues([null, conv('anna', 1)]), 1)
})
