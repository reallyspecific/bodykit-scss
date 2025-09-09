import path from "path";
import { readFileSync as readFile } from "fs";
import * as sass from "sass";
import { transform } from 'lightningcss'; //provided by bodykit

import Compiler from "@reallyspecific/bodykit/compiler";

export default class extends Compiler {

	static type = 'scss';

	include = ['*.scss','*.sass'];

	clean = ['*.debug.css','*.min.css'];

	filenamePattern = '[path]/[name].[ext]';

	minifiedFilename = null;
	compiledFilename = null;

	async build( props ) {

		const debugOut = this.out( path.dirname( props.filepath ), path.basename( props.filename, '.scss' ), '.debug.css', this.compiledFilename ?? props.filenamePattern ?? this.filenamePattern );
		const minifOut = this.out( path.dirname( props.filepath ), path.basename( props.filename, '.scss' ), '.min.css', this.minifiedFilename ?? props.filenamePattern ?? this.filenamePattern  );

		try {

			const result = await sass.compileAsync( props.in, {
				sourceMap: true,
				sourceMapIncludeSources: true,
				quietDeps: true,
				...( props.options ?? this.options ?? {} )
			});

			let { code, map } = await transform(
				{
					code: Buffer.from( result.css ),
					targets: props.targets ?? this.targets,
					minify: true,
					sourceMap: true
				}
			)

			const files = [ {
				...props,
				out: path.join( props.destOut ?? this.destOut, debugOut ),
				filepath: debugOut,
				filename: path.basename( debugOut ),
				ext: path.extname( debugOut ),
				contents: result.css,
			},{
				...props,
				out: path.join( props.destOut ?? this.destOut, debugOut ) + '.map',
				filepath: debugOut + '.map',
				filename: path.basename( debugOut ) + '.map',
				ext: '.map',
				contents: JSON.stringify( result.sourceMap ),
			},{
				...props,
				out: path.join( props.destOut ?? this.destOut, minifOut ),
				filepath: minifOut,
				filename: path.basename( minifOut ),
				ext: path.extname( minifOut ),
				contents: code,
			},{
				...props,
				out: path.join( props.destOut ?? this.destOut, minifOut ) + '.map',
				filepath: minifOut + '.map',
				filename: path.basename( minifOut ) + '.map',
				ext: '.map',
				contents: map,
			} ];

			this.collection.add( ...files );

			return files;

		} catch( error ) {

			const errorMessage = [
				`\x1b[31mError compiling SCSS for \x1b[4m${path.relative(props.sourceIn ?? this.sourceIn, props.in)}`,
			];

			if ( error.hasOwnProperty('_dartException') ) {
				//sass error
				const stackTop = error._dartException.trace.frames[0];
				const tracedSourcePath = path.relative( props.sourceIn ?? this.sourceIn, decodeURI( stackTop.uri.path ) );
				const tracedSourceContents = readFile( decodeURI( stackTop.uri.path ), 'utf8' );
				errorMessage.push(`dartsass: ${error.sassMessage}, \x1b[4m${tracedSourcePath}[${stackTop.line}:${stackTop.column}]` );
				errorMessage.push( ...this.getSourceContext( tracedSourceContents, stackTop.line, stackTop.column ) );

			} else if ( error.hasOwnProperty('source') && ( error.loc?.line ?? false ) ) {
				//lightningcss error, need to figure out line numbers of originals
				errorMessage.push(` lightningcss: ${error.data?.type ?? 'SyntaxError'}: ${error.message}, \x1b[4m${debugOut} [${error.loc.line}:${error.loc.column}]`);
				errorMessage.push( ...this.getSourceContext( error.source, error.loc.line, error.loc.column ) );

			}

			if ( errorMessage.length > 1 ) {

				return [
					{
						...props,
						error: errorMessage.join('\x1b[0m\n'),
					}
				]
			}

			return [ {
				...props,
				error
			} ];

		}

	}

	getSourceContext( source, line, column, linesBefore = 1, linesAfter = 1) {
		const lines = source.split('\n');
		const start = Math.max( 0, line - linesBefore - 1);
		const end = Math.min( lines.length, line + linesAfter);
		const context = [];
		lines.slice( start, end ).forEach( ( thisLine, i ) => {
			const current = start + i + 1;
			if ( current !== line ) {
				context.push(`\x1b[2m${current}:\x1b[0m ${thisLine}`);
				return;
			}
			context.push(
				`\x1b[1m\x1b[2m${current}:\x1b[0m `
				+ thisLine.substring(0, column - 1)
				+ `\x1b[4m\x1b[31m` + thisLine.substring( column - 1, column) + `\x1b[0m`
				+ thisLine.substring( column )
			);
		});
		return context;
	}
}
