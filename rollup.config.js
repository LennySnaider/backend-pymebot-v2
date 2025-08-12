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
        exclude: ['**/app/**/*', 'src/app/**/*'],
        tsconfigOverride: {
            compilerOptions: {
                strict: false,
                skipLibCheck: true,
                noEmitOnError: false,
                declaration: false,
                suppressImplicitAnyIndexErrors: true,
                noImplicitAny: false,
                noImplicitThis: false,
                noImplicitReturns: false
            }
        },
        rollupCommonJSResolveHack: false,
        check: false // Deshabilitar verificación de tipos completamente
    })],
}
