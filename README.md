<div align='center'>
    <br/>
    <br/>
    <h3>vite-plugin-nft</h3>
    <p>Next.js standalone implementation for Vite</p>
    <br/>
    <br/>
</div>

## Usage

Go inside a TypeScript project and run:

```bash
npx tsc-shame

# Generating trace with tsc...

# Top packages by findSourceFile duration:
# =========================================================================
# googleapis         | ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1882.4ms
# @nextui-org/react  | ■■■■■■■■■ 344.1ms
# @sentry/remix      | ■■■■■■■ 262.5ms
# @sentry/node       | ■■■■■■ 210.5ms
# next-auth          | ■■■ 115.8ms
# @types/node        | ■■ 91.7ms
# @remix-run/react   | ■■ 91.0ms
# next               | ■■ 78.5ms
# react-router-dom   | ■■ 68.7ms
# @elysiajs/eden     | ■■ 67.4ms
# stripe             | ■■ 66.5ms
# elysia             | ■■ 65.1ms
# vitest             | ■ 56.1ms
# @sinclair/typebox  | ■ 50.6ms
# kysely             | ■ 49.9ms
# @prisma/client     | ■ 49.8ms
# @types/react       | ■ 48.2ms
# lucide-react       | ■ 47.3ms
# @nextui-org/system | ■ 44.0ms
# @sentry/core       | ■ 43.4ms

# For more details on which node_modules files are causing the slowdown, refer to the tsc tracing guide:
# https://github.com/microsoft/TypeScript-wiki/blob/main/Performance-Tracing.md
```

This command will generate a trace of the `tsc` execution and then print a bar graph of the slowest packages to type check.

This tool helped me remove `googleapis` from my project, which cut in half type checking time.

## License

MIT
