// Copyright 2023, University of Colorado Boulder

/**
 * A template that performs a reduce operation on a single workgroup. The value will be valid at local_id.x === 0.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, commentWGSL, logValueWGSL, u32, unrollWGSL, WGSLContext, WGSLExpression, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type reduceWGSLOptions<T> = {
  // the "input" and "output" variable name
  value: WGSLVariableName;

  // name for var<workgroup> array<T, workgroupSize> TODO: consider abstracting, so we could run multiple reduces
  // TODO: concurrently
  scratch: WGSLVariableName;

  workgroupSize: number;

  binaryOp: BinaryOp<T>;

  // (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex?: WGSLExpressionU32;

  // allows overriding the index used for the scratch array, so that we can run multiple smaller loads in the same
  // workgroup
  mapScratchIndex?: ( index: WGSLExpressionU32 ) => WGSLExpressionU32;

  // Whether we should reduce in a convergent order. This will reduce control divergence when running, and will
  // potentially allow warps to exit early. This should result in a speed-up, but the data either needs to have a
  // commutative combine operation, OR the order should be in a "convergent" order. That would mean that for each data
  // chunk read by each workgroup, the indices are bit-reversed (e.g. if we have a workgroup size of 256, then we are
  // reversing the last 8 bits of the index, thus the first element should be stored at index 0, the second element at
  // index 128, the third element at index 64, etc.). See get_convergent_index for more information.
  // For instance, the order of reduction of the first 16 hex digits (in a convergent order) would be
  // 084c2a6e195d3b7f.
  convergent?: boolean;

  // If true, we won't need to load the value INTO the scratch array
  scratchPreloaded?: boolean;

  // If true, we won't need to load the value FROM the scratch array
  valuePreloaded?: boolean;
};

const DEFAULT_OPTIONS = {
  localIndex: 'local_id.x',
  mapScratchIndex: _.identity,
  convergent: false,
  scratchPreloaded: false,
  valuePreloaded: true
} as const;

const reduceWGSL = <T>(
  context: WGSLContext,
  providedOptions: reduceWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<reduceWGSLOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

  const value = options.value;
  const scratch = options.scratch;
  const workgroupSize = options.workgroupSize;
  const binaryOp = options.binaryOp;
  const localIndex = options.localIndex;
  const mapScratchIndex = options.mapScratchIndex;
  const convergent = options.convergent;
  const scratchPreloaded = options.scratchPreloaded;
  const valuePreloaded = options.valuePreloaded;

  assert && assert( !convergent || Number.isInteger( Math.log2( workgroupSize ) ) );
  assert && assert( scratchPreloaded || valuePreloaded );

  const start = convergent ? Math.log2( workgroupSize ) : 0;
  const end = convergent ? 0 : Math.log2( workgroupSize );
  const condition = ( i: number ) => convergent
    ? `${localIndex} < ${u32( 1 << ( i - 1 ) )}`
    : `${localIndex} % ${u32( 1 << ( i + 1 ) )} == 0u`;
  const accessIndex = ( i: number ) => convergent
    ? `${localIndex} + ${u32( 1 << ( i - 1 ) )}`
    : `${localIndex} + ${u32( 1 << i )}`;

  const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
    return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
  };

  return `
    ${commentWGSL( `begin reduce convergent:${convergent}` )}
    ${!scratchPreloaded ? `
      ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
    ` : ''}
    ${!valuePreloaded ? `
      ${value} = ${scratch}[ ${mapScratchIndex( localIndex )} ];
    ` : ''}
    
    ${logValueWGSL( context, {
      name: `before reduce convergent:${convergent}`,
      value: 'value',
      type: binaryOp.type
    } )}
    
    ${unrollWGSL( start, end, ( i, isFirst, isLast ) => `
      // We don't need the first workgroupBarrier() if scratchPreloaded is true
      ${!scratchPreloaded || !isFirst ? `
        workgroupBarrier();
      ` : ''}

      // TODO: check performance differences with a select/combine?
      if ( ${condition( i )} ) {
        ${combineToValue( value, value, `${scratch}[ ${mapScratchIndex( accessIndex( i ) )} ]` )}

        ${!isLast ? `
          ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
        ` : ''}
      }
    ` )}
    ${commentWGSL( 'end reduce' )}
  `;
};

export default reduceWGSL;

alpenglow.register( 'reduceWGSL', reduceWGSL );
