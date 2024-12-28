<div align='center'>
    <br/>
    <br/>
    <h3>tsc-shame</h3>
    <p>Find heavy node_modules slowing down your tsc type checking</p>
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

## How it works

Under the hood, tsc-shame:

1. Runs `tsc` with the following options:
   - `--incremental false` - Disables incremental compilation
   - `--composite false` - Disables composite project mode
   - `--generateTrace <tempDir>` - Generates trace data in a temporary directory

2. The trace data is saved to a `trace.json` file which contains detailed timing information about TypeScript's compilation process, including:
   - Time spent checking each source file
   - Time spent finding and loading files
   - Time spent binding types

3. tsc-shame then analyzes this trace data to:
   - Group events by file/package name
   - Calculate total duration for each file/package
   - Sort them by duration to identify the slowest ones

4. Finally, it generates two bar graphs showing:
   - Top files by checkSourceFile duration - Shows which individual files take longest to type check
   - Top packages by findSourceFile + bindSourceFile duration - Shows which node_modules packages are slowest overall

This helps identify which dependencies are causing TypeScript performance bottlenecks, allowing you to:
- Remove or replace slow dependencies
- Consider moving slow dependencies to devDependencies if they're only needed for development
- Split up large files that are slow to type check




## License

MIT
