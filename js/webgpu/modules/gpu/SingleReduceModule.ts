// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../imports.js';

export type SingleReduceModuleOptions = {
  test: string;
};

// TODO: this is a stub, fill it out!

export default class SingleReduceModule {
  public constructor( options: SingleReduceModuleOptions ) {
    console.log( 'SingleReduceModule constructor' );
  }
}

alpenglow.register( 'SingleReduceModule', SingleReduceModule );
