import typescript from 'rollup-plugin-typescript2'

export default {
    input: 'src/app.ts',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: 'app.js',
    },
    onwarn: (warning) => {
        if (warning.code === 'UNRESOLVED_IMPORT') return
    },
    plugins: [typescript({
        exclude: ['**/app/**/*', 'src/app/**/*']
    })],
}
