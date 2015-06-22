# Tevatron CLI

Smashes web component HTML imports into a single Javascript file

## Installation
`npm install tevatron-cli`

## Syntax

`tevatron --src /your_source_directory --target /your_target_path`

## Arguments

### --src (-s) [directory]
This directory, and its subdirectories, will be scanned for any HTML and JS files.
Any HTML files containing `<script>` tags, or JS files containing `/* tevatron` comments,
will be included in the smash.

### --target (-t) [directory/filename]
This is the path to where your smashed file(s) will be written. Without the `--concat` flag,
`--target` will be treated as a folder. With `--concat`, it will be treated as a filename and
appended a .js extension.

## Flags
### --concat (-c)
With this flag, all smashed scripts will be concatenated into a single file, with the name
of `--target`

### --minify (-m)
With this flag, all smashed scripts, or the concatenated script, will be minified with
Uglify.js

### --verbose (-v)
With this flag, the builder script will output extra information.