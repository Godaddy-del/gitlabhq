# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Gitlab::Auth::Identity, :request_store, feature_category: :system_access do
  let_it_be(:primary_user) { create(:user) }
  let_it_be(:scoped_user) { create(:user) }

  describe '.link_from_oauth_token' do
    let_it_be(:token_scopes) { [:api, :"user:#{scoped_user.id}"] }
    let_it_be(:oauth_access_token) { create(:oauth_access_token, user: primary_user, scopes: token_scopes) }

    subject(:identity) { described_class.link_from_oauth_token(oauth_access_token) }

    context 'when composite identity is required for the actor' do
      before do
        allow(primary_user).to receive(:has_composite_identity?).and_return(true)
      end

      it 'returns an identity' do
        expect(identity).to be_composite
        expect(identity).to be_linked
        expect(identity).to be_valid

        expect(identity.scoped_user).to eq(scoped_user)
      end

      context 'when oauth token does not have required scopes' do
        let(:oauth_access_token) { create(:oauth_access_token, user: primary_user, scopes: [:api]) }

        it 'fabricates a composite identity which is not valid' do
          expect(identity).to be_composite
          expect(identity).not_to be_linked
          expect(identity).not_to be_valid
        end
      end

      context 'when an identity link was already done for a different composite user' do
        let_it_be(:different_user) { create(:user) }
        let_it_be(:new_token_scopes) { [:api, :"user:#{different_user.id}"] }
        let_it_be(:new_oauth_access_token) do
          create(:oauth_access_token, user: primary_user, scopes: new_token_scopes)
        end

        it 'raises an error' do
          expect(identity).to be_valid

          expect { described_class.link_from_oauth_token(new_oauth_access_token) }
            .to raise_error(::Gitlab::Auth::Identity::IdentityLinkMismatchError)
        end
      end

      context 'when actor user does not have composite identity enforced' do
        before do
          allow(primary_user).to receive(:has_composite_identity?).and_return(false)
        end

        context 'when token has composite user scope' do
          it 'returns an identity' do
            expect(identity).not_to be_composite
            expect(identity).not_to be_linked
          end
        end

        context 'when token does not have composite user scope' do
          let_it_be(:token_scopes) { [:api] }
          let_it_be(:oauth_access_token) do
            create(:oauth_access_token, user: primary_user, scopes: token_scopes)
          end

          it 'returns an identity' do
            expect(identity).not_to be_composite
            expect(identity).not_to be_linked
          end
        end
      end
    end

    context 'when composite identity is not required for the actor' do
      it 'fabricates a valid identity' do
        expect(identity).not_to be_composite
        expect(identity).to be_valid
      end
    end
  end

  describe '.fabricate' do
    subject(:identity) { described_class.fabricate(primary_user) }

    it 'returns a valid identity without a scoped user' do
      expect(identity).to be_valid

      expect { identity.scoped_user }
        .to raise_error(::Gitlab::Auth::Identity::MissingCompositeIdentityError)
    end
  end

  describe '.sidekiq_restore!' do
    context 'when job has primary and scoped identity stored' do
      let(:job) { { 'jid' => 123, 'sqci' => [primary_user.id, scoped_user.id] } }

      it 'finds and links primary user with scoped user' do
        identity = described_class.sidekiq_restore!(job)

        expect(identity).to be_linked
        expect(identity.primary_user).to eq(primary_user)
        expect(identity.scoped_user).to eq(scoped_user)
      end
    end

    context 'when linked identity in job is an unexpected value' do
      let(:job) { { 'jid' => 123, 'sqci' => [primary_user.id] } }

      it 'finds and links primary user with scoped user' do
        expect { described_class.sidekiq_restore!(job) }
          .to raise_error(described_class::IdentityError)
      end
    end
  end

  describe '#sidekiq_link!' do
    let(:job) { { 'jid' => 123 } }

    subject(:identity) { described_class.new(primary_user) }

    before do
      identity.link!(scoped_user)
    end

    it 'sets a job attribute' do
      described_class.new(primary_user).sidekiq_link!(job)

      expect(job[described_class::COMPOSITE_IDENTITY_SIDEKIQ_ARG])
        .to eq([primary_user.id, scoped_user.id])
    end
  end
end
