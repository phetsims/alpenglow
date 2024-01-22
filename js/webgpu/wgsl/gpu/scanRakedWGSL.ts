// Copyright 2023, University of Colorado Boulder

/**
 * Raked workgroup scan. Assumes the existence of things in the scratch array.
 *
 * WILL NEED workgroupBarrier() before/after (before if needed for scratch, after for scratch)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, commentWGSL, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, PipelineBlueprint, RakedSizable, scanWGSL, toStripedIndexWGSL, u32S, unrollWGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStatements, WGSLVariableName, WORKGROUP_INDEXABLE_DEFAULTS, WorkgroupIndexable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type scanRakedWGSLOptions<T> = {
  // varname of var<workgroup> array<${binaryOp.type.valueType}, ${workgroupSize * grainSize}>
  scratch: WGSLVariableName;

  // The direction of the scan. For instance, a left inclusive scan of [ 1, 2, 3, 4 ] is [ 1, 3, 6, 10 ],
  // but a right incluive scan is [ 10, 9, 7, 4 ] (just scans in the other direction)
  direction?: 'left' | 'right'; // TODO: support direction(!)(!)

  binaryOp: BinaryOp<T>;

  // null | ( index expr, expr: T ) => statements - Stores out the "fully reduced" value
  storeReduction?: ( ( index: WGSLExpressionU32, expr: WGSLExpression ) => WGSLStatements ) | null;

  // Whether we should stripe the reduced output (so that each workgroup has a reduced value)
  stripeReducedOutput?: boolean;

  // boolean (whether the scan should be exclusive - otherwise it is inclusive).
  // e.g. an inclusive left scan of [ 1, 2, 3, 4 ] is [ 1, 3, 6, 10 ], whereas an exclusive left scan is [ 0, 1, 3, 6 ]
  exclusive?: boolean;

  // null | ( varName ) => statements - should write a value to be added to everything into the specific variable name
  // This is designed to be used for multi-level scans, where you essentially want to add an "offset" value to
  // everything in the workgroup.
  getAddedValue?: ( ( varName: WGSLVariableName ) => WGSLStatements ) | null;

  // We can opt out of the extra workgroupBarrier if getAddedValue executes one itself (say, for atomics).
  addedValueNeedsWorkgroupBarrier?: boolean;
} & RakedSizable & WorkgroupIndexable & LocalIndexable;

export const SCAN_RAKED_DEFAULTS = {
  direction: 'left',
  exclusive: false,
  storeReduction: null,
  stripeReducedOutput: false,
  getAddedValue: null,
  addedValueNeedsWorkgroupBarrier: true,
  ...WORKGROUP_INDEXABLE_DEFAULTS, // eslint-disable-line no-object-spread-on-non-literals
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line no-object-spread-on-non-literals
} as const;

const scanRakedWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: scanRakedWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<scanRakedWGSLOptions<T>>()( {}, SCAN_RAKED_DEFAULTS, providedOptions );

  const scratch = options.scratch;
  const direction = options.direction;
  const binaryOp = options.binaryOp;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const workgroupIndex = options.workgroupIndex;
  const localIndex = options.localIndex;
  const storeReduction = options.storeReduction;
  const stripeReducedOutput = options.stripeReducedOutput;
  const exclusive = options.exclusive;
  const getAddedValue = options.getAddedValue;
  const addedValueNeedsWorkgroupBarrier = options.addedValueNeedsWorkgroupBarrier;

  const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
    return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
  };

  // TODO: handle right-scans
  assert && assert( direction === 'left' );

  return wgsl`
    ${commentWGSL( 'begin scan_raked' )}

    // TODO: consider factoring out ${localIndex} * ${u32S( grainSize )}? -- it will take up an extra register?

    // TODO: isolate out into scan_sequential?
    // Sequential scan of each thread's tile (inclusive)
    ${commentWGSL( 'begin (sequential scan of tile)' )}
    var value = ${scratch}[ ${localIndex} * ${u32S( grainSize )} ];
    ${unrollWGSL( 1, grainSize, i => wgsl`
      {
        ${combineToValue( wgsl`value`, wgsl`value`, wgsl`${scratch}[ ${localIndex} * ${u32S( grainSize )} + ${u32S( i )} ]` )}
        ${scratch}[ ${localIndex} * ${u32S( grainSize )} + ${u32S( i )} ] = value;
      }
    ` )}
    ${commentWGSL( 'end (sequential scan of tile)' )}

    // For the first scan step, since it will access other indices in scratch
    workgroupBarrier();

    // Scan the last-scanned element of each thread's tile (inclusive)
    ${scanWGSL( blueprint, {
      value: wgsl`value`,
      scratch: scratch,
      workgroupSize: workgroupSize,
      binaryOp: binaryOp,
      mapScratchIndex: index => wgsl`( ${index} ) * ${u32S( grainSize )} + ${u32S( grainSize - 1 )}`,
      exclusive: false,
      needsValidScratch: true,

      // both wgsl`'`value' and the scratch value should be matching!
      scratchPreloaded: true,
      valuePreloaded: true
    } )}

    workgroupBarrier();

    // IF exclusive and we want the full reduced value, we'd need to extract it now.
    // TODO: we'll need to change indices if we allow right-scans(!)
    ${storeReduction ? wgsl`
      ${commentWGSL( 'begin (store reduction)' )}
      if ( ${localIndex} == ${u32S( workgroupSize - 1 )} ) {
        ${storeReduction(
          stripeReducedOutput ? toStripedIndexWGSL( {
            i: workgroupIndex,
            workgroupSize: workgroupSize,
            grainSize: grainSize
          } ) : workgroupIndex,
          wgsl`value`
        )}
      }
      ${commentWGSL( 'end (store reduction)' )}
    ` : wgsl``}

    // Add those values into all the other elements of the next tile
    ${commentWGSL( 'begin (add scanned values to tile)' )}
    var added_value = select( ${binaryOp.identityWGSL}, ${scratch}[ ${localIndex} * ${u32S( grainSize )} - 1u ], ${localIndex} > 0 );
    ${getAddedValue ? wgsl`
      ${commentWGSL( 'begin (get global added values)' )}

      // Get the value we'll add to everything
      var workgroup_added_value: ${binaryOp.type.valueType};
      ${getAddedValue( wgsl`workgroup_added_value` )}

      // We need to LOAD the value before anything writes to it, since we'll be modifying those values
      ${addedValueNeedsWorkgroupBarrier ? wgsl`
        workgroupBarrier();
      ` : wgsl``}

      // Update the last element of this tile (which would otherwise go untouched)
      {
        let last_value = ${scratch}[ ${localIndex} * ${u32S( grainSize )} + ${u32S( grainSize - 1 )} ];

        var new_last_value: ${binaryOp.type.valueType};
        ${combineToValue( wgsl`new_last_value`, wgsl`workgroup_added_value`, wgsl`last_value` )}

        ${scratch}[ ${localIndex} * ${u32S( grainSize )} + ${u32S( grainSize - 1 )} ] = new_last_value;
      }

      // Add the value to what we'll add to everything else
      ${combineToValue( wgsl`added_value`, wgsl`workgroup_added_value`, wgsl`added_value` )}

      ${commentWGSL( 'end (get global added values)' )}
    ` : wgsl`
    `}
    ${unrollWGSL( 0, grainSize - 1, i => wgsl`
      {
        let index = ${localIndex} * ${u32S( grainSize )} + ${u32S( i )};
        var current_value: ${binaryOp.type.valueType};
        ${combineToValue( wgsl`current_value`, wgsl`added_value`, wgsl`${scratch}[ index ]` )}
        ${scratch}[ index ] = current_value;
      }
    ` )}
    ${commentWGSL( 'end (add scanned values to tile)' )}
    
    // TODO: consider shift at start to potentially avoid this workgroupBarrier?
    ${exclusive ? wgsl`
      workgroupBarrier();
      
      // TODO: will it be more readable/maintainable for these two cases to be combined?
      ${direction === 'left' ? wgsl`
        let exclusive_base_index = ${localIndex} * ${u32S( grainSize )};
        var exclusive_value = select( ${binaryOp.identityWGSL}, ${scratch}[ exclusive_base_index - 1u ], exclusive_base_index > 0u );
        var next_value = ${scratch}[ exclusive_base_index ];
        workgroupBarrier();
        ${unrollWGSL( 0, grainSize, ( i, isFirst, isLast ) => wgsl`
          ${!isLast ? wgsl`
            next_value = ${scratch}[ exclusive_base_index + ${u32S( i )} ];
          ` : wgsl``}
          ${scratch}[ exclusive_base_index + ${u32S( i )} ] = exclusive_value;
          ${!isLast ? wgsl`
            exclusive_value = next_value;
          ` : wgsl``}
        ` )}
      ` : wgsl`
        let exclusive_base_index = ${localIndex} * ${u32S( grainSize )} + ${u32S( grainSize - 1 )};
        var exclusive_value = select( ${binaryOp.identityWGSL}, ${scratch}[ exclusive_base_index + 1u ], exclusive_base_index < ${u32S( workgroupSize - 1 )} );
        var next_value = ${scratch}[ exclusive_base_index ];
        workgroupBarrier();
        ${unrollWGSL( 0, grainSize, ( i, isFirst, isLast ) => wgsl`
          ${!isLast ? wgsl`
            next_value = ${scratch}[ exclusive_base_index + ${u32S( i )} ];
          ` : wgsl``}
          ${scratch}[ exclusive_base_index - ${u32S( i )} ] = exclusive_value;
          ${!isLast ? wgsl`
            exclusive_value = next_value;
          ` : wgsl``}
        ` )}
      `}
    ` : wgsl``}

    ${commentWGSL( 'end scan_raked' )}
  `;
};

export default scanRakedWGSL;

alpenglow.register( 'scanRakedWGSL', scanRakedWGSL );
