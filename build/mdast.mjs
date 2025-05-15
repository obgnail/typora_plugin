import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'

import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math'
import { ofmFromMarkdown, ofmToMarkdown } from '@moritzrs/mdast-util-ofm'

import { math } from 'micromark-extension-math'
import { gfm } from 'micromark-extension-gfm'
import { ofm } from '@moritzrs/micromark-extension-ofm'

const fromMD = md => fromMarkdown(md, {
    extensions: [
        gfm(),
        math(),
        ofm(),
    ],
    mdastExtensions: [
        gfmFromMarkdown(),
        mathFromMarkdown(),
        ofmFromMarkdown(),
    ]
})

const toMD = tree => toMarkdown(tree, {
    extensions: [
        gfmToMarkdown(),
        mathToMarkdown(),
        ofmToMarkdown(),
    ]
})

export { fromMD, toMD }
