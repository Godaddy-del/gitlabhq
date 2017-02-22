require 'rails_helper'

describe GpgKey do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
  end

  describe "validation" do
    it { is_expected.to validate_presence_of(:key) }
    it { is_expected.to validate_uniqueness_of(:key) }
    it { is_expected.to allow_value("-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey").for(:key) }
    it { is_expected.not_to allow_value("-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey\n-----BEGIN PGP PUBLIC KEY BLOCK-----").for(:key) }
    it { is_expected.not_to allow_value('BEGIN PGP').for(:key) }
  end

  context 'callbacks' do
    describe 'extract_fingerprint' do
      it 'extracts the fingerprint from the gpg key', :gpg do
        gpg_key = described_class.new(key: GpgHelpers.public_key)
        gpg_key.valid?
        expect(gpg_key.fingerprint).to eq '4F4840A503964251CF7D7F5DC728AF10972E97C0'
      end
    end
  end

  describe '#key=' do
    it 'strips white spaces' do
      key = <<~KEY.strip
        -----BEGIN PGP PUBLIC KEY BLOCK-----
        Version: GnuPG v1

        mQENBFMOSOgBCADFCYxmnXFbrDhfvlf03Q/bQuT+nZu46BFGbo7XkUjDowFXJQhP
        -----END PGP PUBLIC KEY BLOCK-----
      KEY

      expect(described_class.new(key: " #{key} ").key).to eq(key)
    end
  end

  describe '#emails' do
    it 'returns the emails from the gpg key' do
      gpg_key = create :gpg_key

      expect(gpg_key.emails).to match_array %w(mail@koffeinfrei.org lex@panter.ch)
    end
  end
end
