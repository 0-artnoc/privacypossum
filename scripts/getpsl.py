#!/usr/bin/env python
'''
Based on a Privacy Badger pull request:
https://github.com/cowlicks/privacybadgerchrome/blob/300d41eb1de22493aabdb46201a148c028a6228d/scripts/convertpsl.py
'''

# script based on
# https://github.com/adblockplus/buildtools/blob/d090e00610a58cebc78478ae33e896e6b949fc12/publicSuffixListUpdater.py

import json

import urllib.request

psl_url = 'https://publicsuffix.org/list/public_suffix_list.dat'

file_text = '''/* eslint-disable */
"use strict";

const publicSuffixes = new Map(
%s
);

export {publicSuffixes};'''


def get_psl_text():
    return urllib.request.urlopen(psl_url).read()


def punycode(x):
    return x.encode('idna').decode()


def convert(psl_lines):
    suffixes = []

    for line in psl_lines:
        if line.startswith('//') or '.' not in line:
            continue
        if line.startswith('*.'):
            suffixes.append([punycode(line[2:]), ])
        elif line.startswith('!'):
            suffixes.append([punycode(line[1:]), 0])
        else:
            suffixes.append([punycode(line), 1])

    entries = sorted(suffixes, key=lambda x: x[0])
    return file_text % '],\n'.join(json.dumps(entries).split('], '))


if __name__ == '__main__':
    psl_lines = get_psl_text().decode().split('\n')
    print(convert(psl_lines))
