import path from "path";
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

		try {

			const debugOut = this.out( path.dirname( props.filepath ), path.basename( props.filename, '.scss' ), '.debug.css', this.compiledFilename ?? props.filenamePattern ?? this.filenamePattern );
			const minifOut = this.out( path.dirname( props.filepath ), path.basename( props.filename, '.scss' ), '.min.css', this.minifiedFilename ?? props.filenamePattern ?? this.filenamePattern  );

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

			return [ {
				...props,
				error: {
					type: error.data?.type ?? error.name,
					line: error.loc?.line ?? error.cause?.line ?? null,
					column: error.loc?.column ?? error.cause?.column ?? null,
					path: `.${error.fileName?.replace( this.sourceIn, '' ) ?? ''}`,
					message: error.message,
					stack: error.stack ?? null,
				}
			} ];

		}

	}

}
