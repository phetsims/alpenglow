// Copyright 2023-2024, University of Colorado Boulder

/**
 * A template that performs a reduce operation on a single workgroup. The value will be valid at local_id.x === 0.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, commentWGSL, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, logValueWGSL, u32S, unrollWGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStatements, WGSLVariableName, WorkgroupSizable } from '../../../imports.js';

export type reduceWGSLOptions<T> = {
  // the "input" and "output" variable name
  value: WGSLVariableName;

  // name for var<workgroup> array<T, workgroupSize> TODO: consider abstracting, so we could run multiple reduces
  // TODO: concurrently
  scratch: WGSLVariableName;

  binaryOp: BinaryOp<T>;

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
} & WorkgroupSizable & LocalIndexable;

export const REDUCE_DEFAULTS = {
  mapScratchIndex: _.identity,
  convergent: false,
  scratchPreloaded: false,
  valuePreloaded: true,
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

const reduceWGSL = <T>(
  providedOptions: reduceWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<reduceWGSLOptions<T>>()( {}, REDUCE_DEFAULTS, providedOptions );

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
    ? wgsl`${localIndex} < ${u32S( 1 << ( i - 1 ) )}`
    : wgsl`${localIndex} % ${u32S( 1 << ( i + 1 ) )} == 0u`;
  const accessIndex = ( i: number ) => convergent
    ? wgsl`${localIndex} + ${u32S( 1 << ( i - 1 ) )}`
    : wgsl`${localIndex} + ${u32S( 1 << i )}`;

  const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
    return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
  };

  return wgsl`
    ${commentWGSL( `begin reduce convergent:${convergent}` )}
    ${!scratchPreloaded ? wgsl`
      ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
    ` : wgsl``}
    ${!valuePreloaded ? wgsl`
      ${value} = ${scratch}[ ${mapScratchIndex( localIndex )} ];
    ` : wgsl``}
    
    ${logValueWGSL( {
      name: `before reduce convergent:${convergent}`,
      value: 'value',
      type: binaryOp.type
    } )}
    
    ${unrollWGSL( start, end, ( i, isFirst, isLast ) => wgsl`
      // We don't need the first workgroupBarrier() if scratchPreloaded is true
      ${!scratchPreloaded || !isFirst ? wgsl`
        workgroupBarrier();
      ` : wgsl``}

      // TODO: check performance differences with a select/combine?
      if ( ${condition( i )} ) {
        ${combineToValue( value, value, wgsl`${scratch}[ ${mapScratchIndex( accessIndex( i ) )} ]` )}

        ${!isLast ? wgsl`
          ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
        ` : wgsl``}
      }
    ` )}
    ${commentWGSL( 'end reduce' )}
  `;
};

export default reduceWGSL;

alpenglow.register( 'reduceWGSL', reduceWGSL );