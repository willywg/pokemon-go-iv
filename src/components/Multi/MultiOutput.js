import React, { Component, PropTypes } from 'react';
import { minBy, maxBy, take, forEach, filter } from 'lodash';
import '~/assets/stylesheets/Output.scss';
import '~/assets/stylesheets/Utility.scss';
import * as Helper from '~/components/Helper/HelperFunctions';
import Multiplier from '~/assets/data/Multiplier.json';
import FinderOutputRow from '../FinderOutputRow';

class Output extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    searchList: PropTypes.array.isRequired,
    options: PropTypes.object.isRequired,
    bestStat: PropTypes.string.isRequired,
    overallAppraisal: PropTypes.string.isRequired,
    ivAppraisal: PropTypes.string.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = { solutions: [], inputs: [], nextId: 0 };
    this.filterSolutions = this.filterSolutions.bind(this);
    this.findSolutions = this.findSolutions.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.name !== '') {
      let solutions = null;
      forEach(nextProps.searchList, (searchObj) => {
        // overkill check
        if (searchObj.cp !== '' || searchObj.hp !== '' || searchObj.dust !== '') {
          const newSolutions = this.findSolutions(nextProps, searchObj);
          solutions = this.filterSolutions(solutions, newSolutions);
        }
      });

      this.setState({
        solutions,
      });
    }
  }

  filterSolutions(currentSolutions, newSolutions) {
    if (currentSolutions === null) {
      return newSolutions;
    }

    const filteredSolutions = [];
    // Fix this naive loop
    for (let o = 0; o < currentSolutions.length; ++o) {
      for (let n = 0; n < newSolutions.length; ++n) {
        const solution1 = currentSolutions[o];
        const solution2 = newSolutions[n];

        if (solution1.stamina === solution2.stamina &&
          solution1.attack === solution2.attack &&
          solution1.defense === solution2.defense) {
          const newSolution = solution1;
          newSolution.displayLevel = `${newSolution.displayLevel}/${solution2.displayLevel}`;
          filteredSolutions.push(newSolution);
          break;
        }
      }
    }

    return filteredSolutions;
  }

// Assume all data here is valid, as it should've been checked by the input.
  findSolutions(nextProps, searchData) {
    const { name, options,
      overallAppraisal, bestStat, ivAppraisal } = nextProps;
    const hp = Number(searchData.hp);
    const cp = Number(searchData.cp);
    const dust = Number(searchData.dust);
    const dustData = Helper.getDustData(dust);
    const newSolutions = [];
    const pokemon = Helper.getPokemonData(name);

    let id = 0;

    for (let level = dustData.minLevel; level <= dustData.maxLevel; level += 2) {
      const multiplierData = Multiplier.find((data) =>
        (data.level === level));
      const m = multiplierData.multiplier;
      const fullLevel = options.fullLevel || false;
      const displayLevel = fullLevel ? level : multiplierData.altLevel;

      for (let stamina = 0; stamina <= 15; ++stamina) {
        for (let attack = 0; attack <= 15; ++attack) {
          for (let defense = 0; defense <= 15; ++defense) {
            const stats = Helper.getPokemonStats(pokemon, attack, defense, stamina, m);
            const calcCP = Helper.calculateCP(stats.attack, stats.defense, stats.stamina, m);

            const statSum = stamina + attack + defense;
            let appraisalMatch = false;
            if ((overallAppraisal === 'great' && statSum >= 37) ||
              (overallAppraisal === 'good' && statSum >= 30 && statSum < 37) ||
              (overallAppraisal === 'average' && statSum >= 23 && statSum < 30) ||
              (overallAppraisal === 'bad' && statSum < 23) ||
              (overallAppraisal === '')) {
              appraisalMatch = true;
            }

            let bestStatMatch = false;
            let statToCheck = 0;
            if (bestStat === '') { bestStatMatch = true; }
            if (bestStat === 'sad' &&
              stamina === attack && stamina === defense && attack === defense) {
              bestStatMatch = true;
              statToCheck = stamina;
            }
            // implicit checks: if a === b, and a > c, then b > c.
            if (bestStat === 'sa' && stamina === attack && stamina > defense) {
              bestStatMatch = true;
              statToCheck = stamina;
            }
            if (bestStat === 'sd' && stamina === defense && stamina > attack) {
              bestStatMatch = true;
              statToCheck = stamina;
            }
            if (bestStat === 'ad' && attack === defense && attack > stamina) {
              bestStatMatch = true;
              statToCheck = attack;
            }
            if (bestStat === 's' && stamina > attack && stamina > defense) {
              bestStatMatch = true;
              statToCheck = stamina;
            }
            if (bestStat === 'a' && attack > stamina && attack > defense) {
              bestStatMatch = true;
              statToCheck = attack;
            }
            if (bestStat === 'd' && defense > attack && defense > stamina) {
              bestStatMatch = true;
              statToCheck = defense;
            }

            let ivStatMatch = false;
            if ((ivAppraisal === '') || (bestStat === '') ||
              (ivAppraisal === 'great' && statToCheck === 15) ||
              (ivAppraisal === 'good' && statToCheck >= 13 && statToCheck < 15) ||
              (ivAppraisal === 'average' && statToCheck >= 8 && statToCheck < 13) ||
              (ivAppraisal === 'bad' && statToCheck < 8)) {
              ivStatMatch = true;
            }

            if (calcCP === cp && hp === Math.max(10, Math.floor(stats.stamina))
              && appraisalMatch && bestStatMatch && ivStatMatch) {
              const atkPercent = Helper.getOffensivePotential(pokemon, attack, defense, stamina);
              const defPercent = Helper.getDefensivePotential(pokemon, attack, defense, stamina);
              // ratio between your ivs and max ivs
              const perfection = (attack + defense + stamina) / 45 * 100;

              newSolutions.push({
                level, displayLevel, stamina, attack, defense, id, atkPercent, defPercent,
                perfection,
              });
              id++;
            }
          }
        }
      }
    }

    return newSolutions;
  }

  render() {
    const { solutions } = this.state;

    if (this.props.name === '') {
      return <div></div>;
    }

    const solutionDisplay = take(solutions, Math.min(solutions.length, 150));
    let solutionAmount = '';
    if (solutionDisplay.length < solutions.length) {
      solutionAmount = '(First 150 shown)';
    }

    const word = solutions.length === 1 ? 'solution' : 'solutions';
    let range = [];
    if (solutions.length > 0) {
      const minLevel = minBy(solutions, 'level').level;
      const maxLevel = maxBy(solutions, 'level').level;

      for (let i = minLevel; i <= maxLevel; ++i) {
        const levelSol = filter(solutions, ['level', i]);
        if (levelSol.length > 0) {
          const perfMin = parseFloat(minBy(levelSol, 'perfection').perfection).toFixed(0);
          const perfMax = parseFloat(maxBy(levelSol, 'perfection').perfection).toFixed(0);
          // hacky way to get the display level without requesting and checking localStorage options
          const displayLevel = levelSol[0].displayLevel;

          range.push(
            <tr key={displayLevel}>
              <td><div className="text-center">{displayLevel}</div></td>
              <td><div className="text-center">{perfMin}% - {perfMax}%</div></td>
              <td><div className="text-center">{levelSol.length}</div></td>
            </tr>
          );
        }
      }
    }

    const summary = (
      <tr>
        <td colSpan="3"><center>{solutions.length} {word} found. {solutionAmount}</center></td>
      </tr>);

    return (
      <div className="section">
        <table className="table iv-table">
          <thead>
            <tr>
              <th><div className="text-center">lv</div></th>
              <th><div className="text-center">range</div></th>
              <th><div className="text-center">solutions</div></th>
            </tr>
          </thead>
          <tbody>
            {range}
            {summary}
          </tbody>
        </table>
        <div className="new-section">
          <table className="table">
            <thead>
              <tr>
                <th>lv</th>
                <th><div className="text-center">ivs</div></th>
                <th><div className="text-center">iv %</div></th>
                <th><div className="text-center">potential</div></th>
              </tr>
            </thead>
            <tbody>
              {solutionDisplay.map((solution) => (
                <FinderOutputRow {...solution} options={this.props.options} key={solution.id} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default Output;
