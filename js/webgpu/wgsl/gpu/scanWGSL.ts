// Copyright 2023, University of Colorado Boulder

/**
 * A template that performs a scan operation using workgroup memory on a single workgroup (one value per thread).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, commentWGSL, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, u32, unrollWGSL, WGSLContext, WGSLExpression, WGSLExpressionU32, WGSLStatements, WGSLVariableName, WorkgroupSizable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  // the "input" and "output" variable name
  value: WGSLVariableName;

  // name for var<workgroup> array<T, workgroupSize> TODO: consider abstracting, so we could run multiple reduces
  // TODO: concurrently
  scratch: WGSLVariableName;

  // The direction of the scan. For instance, a left inclusive scan of [ 1, 2, 3, 4 ] is [ 1, 3, 6, 10 ],
  // but a right incluive scan is [ 10, 9, 7, 4 ] (just scans in the other direction)
  direction?: 'left' | 'right';

  binaryOp: BinaryOp<T>;

  // allows overriding the index used for the scratch array, so that we can run multiple smaller loads in the same
  // workgroup
  mapScratchIndex?: ( index: WGSLExpressionU32 ) => WGSLExpressionU32;

  // boolean (whether the scan should be exclusive - otherwise it is inclusive).
  // e.g. an inclusive left scan of [ 1, 2, 3, 4 ] is [ 1, 3, 6, 10 ], whereas an exclusive left scan is [ 0, 1, 3, 6 ]
  exclusive?: boolean;

  // if the scratch value doesn't need to be accurate, we can skip this
  needsValidScratch?: boolean;

  // TODO: some of this is duplicated with reduce.wgsl, how can we factor it out?
  // If true, we won't need to load the value INTO the scratch array
  scratchPreloaded?: boolean;

  // If true, we won't need to load the value FROM the scratch array
  valuePreloaded?: boolean;
} & WorkgroupSizable & LocalIndexable;

export type scanWGSLOptions<T> = SelfOptions<T>;

export const SCAN_DEFAULTS = {
  direction: 'left',
  exclusive: false,
  mapScratchIndex: _.identity,
  needsValidScratch: false, // TODO: think about the best default?
  scratchPreloaded: false,
  valuePreloaded: true,
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line no-object-spread-on-non-literals
} as const;

const scanWGSL = <T>(
  context: WGSLContext,
  providedOptions: scanWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<scanWGSLOptions<T>, SelfOptions<T>>()( {}, SCAN_DEFAULTS, providedOptions );

  const value = options.value;
  const scratch = options.scratch;
  const direction = options.direction;
  const workgroupSize = options.workgroupSize;
  const binaryOp = options.binaryOp;
  const localIndex = options.localIndex;
  const mapScratchIndex = options.mapScratchIndex;
  const exclusive = options.exclusive;
  const needsValidScratch = options.needsValidScratch;
  const scratchPreloaded = options.scratchPreloaded;
  const valuePreloaded = options.valuePreloaded;

  const condition = ( i: number ) => direction === 'left'
    ? `${localIndex} >= ${u32( 1 << i )}`
    : `${localIndex} < ${u32( workgroupSize - ( 1 << i ) )}`;

  const combineLeft = ( i: number ) => direction === 'left'
    ? `${scratch}[ ${mapScratchIndex( `${localIndex} - ${u32( 1 << i )}` )} ]`
    : value;

  const combineRight = ( i: number ) => direction === 'left'
    ? value
    : `${scratch}[ ${mapScratchIndex( `${localIndex} + ${u32( 1 << i )}` )} ]`;

  const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
    return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
  };

  return `
    ${commentWGSL( `begin scan direction:${direction} exclusive:${exclusive}` )}
    ${!scratchPreloaded ? `
      ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
    ` : ''}
    ${!valuePreloaded ? `
      ${value} = ${scratch}[ ${mapScratchIndex( localIndex )} ];
    ` : ''}

    ${unrollWGSL( 0, Math.log2( workgroupSize ), ( i, isFirst, isLast ) => `
      // TODO: duplicated with reduce.wgsl... factor something out? Eventually?
      // We don't need the first workgroupBarrier() if scratchPreloaded is true
      ${!scratchPreloaded || !isFirst ? `
        workgroupBarrier();
      ` : ''}

      // TODO: check performance differences with a select/combine?
      if ( ${condition( i )} ) {
        ${combineToValue( value, combineLeft( i ), combineRight( i ) )}
      }

      ${isLast && !needsValidScratch && !exclusive ? '' : `
        workgroupBarrier();

        ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
      `}
    ` )}

    // TODO: consider shift at start to potentially avoid this workgroupBarrier?
    ${exclusive ? `
      workgroupBarrier();

      ${direction === 'left' ? `
        ${value} = select( ${binaryOp.identityWGSL}, ${scratch}[ ${mapScratchIndex( `${localIndex} - 1u` )} ], ${localIndex} > 0u );
      ` : `
        ${value} = select( ${binaryOp.identityWGSL}, ${scratch}[ ${mapScratchIndex( `${localIndex} + 1u` )} ], ${localIndex} < ${u32( workgroupSize - 1 )} );
      `}
    ` : ''}

    // TODO: consider if we should update the scratch values after, OR keep it nice after exclusive.
    ${commentWGSL( 'end scan' )}
  `;
};

export default scanWGSL;

alpenglow.register( 'scanWGSL', scanWGSL );
